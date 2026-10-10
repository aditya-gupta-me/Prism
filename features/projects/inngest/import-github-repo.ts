import ky from "ky";
import { z } from "zod";
import { Octokit } from "octokit";
import { isBinaryFile } from "isbinaryfile";
import { NonRetriableError } from "inngest";

import { convex } from "@/lib/convex-client";
import { inngest } from "@/inngest/client";
import { getGithubTokenForUser } from "@/lib/github-token";
import { toNonRetriableIfPermanent } from "@/lib/github-errors";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface ImportGithubRepoEvent {
  owner: string;
  repo: string;
  projectId: Id<"projects">;
  userId: string;
}

const importEventSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  projectId: z.string().min(1),
  userId: z.string().min(1),
});

export const importGithubRepo = inngest.createFunction(
  {
    id: "import-github-repo",
    retries: 3,
    // Serialize imports per project so a re-import can't race a still-running
    // one against the same file tree.
    concurrency: [{ key: "event.data.projectId", limit: 1 }],
    onFailure: async ({ event, step }) => {
      const internalKey = process.env.PRISM_CONVEX_INTERNAL_KEY;
      if (!internalKey) return;

      const { projectId } = event.data.event.data as ImportGithubRepoEvent;

      await step.run("set-failed-status", async () => {
        await convex.mutation(api.system.updateImportStatus, {
          internalKey,
          projectId,
          status: "failed",
        });
      });
    },
  },
  { event: "github/import.repo" },
  async ({ event, step }) => {
    const validation = importEventSchema.safeParse(event.data);
    if (!validation.success) {
      throw new NonRetriableError(
        `Invalid github/import.repo payload: ${validation.error.message}`,
      );
    }
    const { owner, repo, projectId, userId } =
      event.data as ImportGithubRepoEvent;

    const internalKey = process.env.PRISM_CONVEX_INTERNAL_KEY;
    if (!internalKey) {
      throw new NonRetriableError(
        "PRISM_CONVEX_INTERNAL_KEY is not configured",
      );
    }

    // Fetch a fresh token at execution time so it never lives in the event
    // payload / step storage and each retry uses an unexpired token.
    const githubToken = await getGithubTokenForUser(userId);
    if (!githubToken) {
      throw new NonRetriableError("GitHub account not connected");
    }

    const octokit = new Octokit({ auth: githubToken });

    // Cleanup any existing files, paginated so a large stale project is cleared
    // across several bounded transactions instead of one oversized one.
    let cleanupPass = 0;
    let cleanupHasMore = true;
    while (cleanupHasMore) {
      const res = await step.run(`cleanup-project-${cleanupPass}`, async () => {
        return await convex.mutation(api.system.cleanup, {
          internalKey,
          projectId,
          limit: 200,
        });
      });
      cleanupHasMore = res.hasMore;
      cleanupPass += 1;
    }

    // Fetch the tree and slim it to path/type/sha only, so the step output
    // stays well under Inngest's size limit. Bail loudly if GitHub truncated
    // the listing rather than silently importing a partial repo.
    const treeItems = await step.run("fetch-repo-tree", async () => {
      try {
        const { data: repoInfo } = await octokit.rest.repos.get({
          owner,
          repo,
        });

        const { data } = await octokit.rest.git.getTree({
          owner,
          repo,
          tree_sha: repoInfo.default_branch,
          recursive: "1",
        });

        if (data.truncated) {
          throw new NonRetriableError(
            "Repository tree is too large to import (GitHub truncated the listing)",
          );
        }

        return data.tree
          .filter((item) => item.path)
          .map((item) => ({
            path: item.path!,
            type: item.type as "tree" | "blob",
            sha: item.sha ?? null,
          }));
      } catch (error) {
        // Preserve our own terminal error; classify GitHub 4xx (e.g. repo not
        // found / no access) as permanent so it fails fast.
        if (error instanceof NonRetriableError) throw error;
        toNonRetriableIfPermanent(error);
      }
    });

    // Sort folders by depth so parents are created before children
    // Input:  [{ path: "src/components" }, { path: "src" }, { path: "src/components/ui" }]
    // Output: [{ path: "src" }, { path: "src/components" }, { path: "src/components/ui" }]
    const folders = treeItems
      .filter((item) => item.type === "tree")
      .sort((a, b) => a.path.split("/").length - b.path.split("/").length);

    // Return the folder map from the step so it can be used in subsequent steps
    // (Inngest serializes step results, so we use a plain object instead of Map).
    // upsert:true makes this step retry-safe — a re-run resolves the same
    // existing folder ids and rebuilds an identical map.
    const folderIdMap = await step.run("create-folders", async () => {
      const map: Record<string, Id<"files">> = {};

      for (const folder of folders) {
        const pathParts = folder.path.split("/");
        const name = pathParts.pop()!;
        const parentPath = pathParts.join("/");
        const parentId = parentPath ? map[parentPath] : undefined;

        const folderId = await convex.mutation(api.system.createFolder, {
          internalKey,
          projectId,
          name,
          parentId,
          upsert: true,
        });

        map[folder.path] = folderId;
      }

      return map;
    });

    // Get all files (blobs) from the tree
    const allFiles = treeItems.filter(
      (item) => item.type === "blob" && item.sha,
    );

    // Create files in bounded batches so completed batches are memoized. A
    // transient failure (a GitHub 500, a network blip) retries only the failed
    // batch; upsert:true makes re-running an already-partially-applied batch
    // safe instead of poisoning the whole import.
    const BATCH_SIZE = 20;
    for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
      const batch = allFiles.slice(i, i + BATCH_SIZE);
      await step.run(`create-files-${i / BATCH_SIZE}`, async () => {
        for (const file of batch) {
          if (!file.sha) {
            continue;
          }

          const { data: blob } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: file.sha,
          });

          const buffer = Buffer.from(blob.content, "base64");
          const isBinary = await isBinaryFile(buffer);

          const pathParts = file.path.split("/");
          const name = pathParts.pop()!;
          const parentPath = pathParts.join("/");
          const parentId = parentPath ? folderIdMap[parentPath] : undefined;

          if (isBinary) {
            const uploadUrl = await convex.mutation(
              api.system.generateUploadUrl,
              { internalKey },
            );

            const { storageId } = await ky
              .post(uploadUrl, {
                headers: { "Content-Type": "application/octet-stream" },
                body: buffer,
              })
              .json<{ storageId: Id<"_storage"> }>();

            await convex.mutation(api.system.createBinaryFile, {
              internalKey,
              projectId,
              name,
              storageId,
              parentId,
              upsert: true,
            });
          } else {
            const content = buffer.toString("utf-8");

            await convex.mutation(api.system.createFile, {
              internalKey,
              projectId,
              name,
              content,
              parentId,
              upsert: true,
            });
          }
        }

        return { created: batch.length };
      });
    }

    await step.run("set-completed-status", async () => {
      await convex.mutation(api.system.updateImportStatus, {
        internalKey,
        projectId,
        status: "completed",
      });
    });

    return { success: true, projectId };
  },
);
