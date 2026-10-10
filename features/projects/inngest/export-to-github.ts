import ky from "ky";
import { z } from "zod";
import { Octokit } from "octokit";
import { NonRetriableError } from "inngest";

import { convex } from "@/lib/convex-client";
import { inngest } from "@/inngest/client";
import { getGithubTokenForUser } from "@/lib/github-token";
import { toNonRetriableIfPermanent } from "@/lib/github-errors";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface ExportToGithubEvent {
  projectId: Id<"projects">;
  repoName: string;
  visibility: "public" | "private";
  description?: string;
  userId: string;
}

const exportEventSchema = z.object({
  projectId: z.string().min(1),
  repoName: z.string().min(1),
  visibility: z.enum(["public", "private"]),
  description: z.string().optional(),
  userId: z.string().min(1),
});

// File metadata only (no content) — content is fetched per-file inside the
// batched blob steps so no single step output carries the whole project.
interface ManifestFile {
  _id: Id<"files">;
  name: string;
  type: "file" | "folder";
  parentId?: Id<"files">;
}

type TreeItem = {
  path: string;
  mode: "100644";
  type: "blob";
  sha: string;
};

export const exportToGithub = inngest.createFunction(
  {
    id: "export-to-github",
    retries: 3,
    cancelOn: [
      {
        event: "github/export.cancel",
        if: "event.data.projectId == async.data.projectId",
      },
    ],
    onFailure: async ({ event, step }) => {
      const internalKey = process.env.PRISM_CONVEX_INTERNAL_KEY;
      if (!internalKey) return;

      const { projectId } = event.data.event.data as ExportToGithubEvent;

      await step.run("set-failed-status", async () => {
        await convex.mutation(api.system.updateExportStatus, {
          internalKey,
          projectId,
          status: "failed",
        });
      });
    },
  },
  {
    event: "github/export.repo",
  },
  async ({ event, step }) => {
    const validation = exportEventSchema.safeParse(event.data);
    if (!validation.success) {
      throw new NonRetriableError(
        `Invalid github/export.repo payload: ${validation.error.message}`,
      );
    }
    const { projectId, repoName, visibility, description, userId } =
      event.data as ExportToGithubEvent;

    const internalKey = process.env.PRISM_CONVEX_INTERNAL_KEY;
    if (!internalKey) {
      throw new NonRetriableError(
        "PRISM_CONVEX_INTERNAL_KEY is not configured",
      );
    }

    // Re-verify ownership at execution time (defense in depth against
    // replayed/tampered events).
    const project = await step.run("verify-ownership", async () => {
      return await convex.query(api.system.getOwnedProject, {
        internalKey,
        projectId,
        ownerId: userId,
      });
    });

    if (!project) {
      throw new NonRetriableError(
        "Project not found or not owned by requesting user",
      );
    }

    // Fetch a fresh token at execution time so it never lives in the event
    // payload / step storage and each retry uses an unexpired token.
    const githubToken = await getGithubTokenForUser(userId);
    if (!githubToken) {
      throw new NonRetriableError("GitHub account not connected");
    }

    // Set status to exporting
    await step.run("set-exporting-status", async () => {
      await convex.mutation(api.system.updateExportStatus, {
        internalKey,
        projectId,
        status: "exporting",
      });
    });

    const octokit = new Octokit({ auth: githubToken });

    // Get authenticated user
    const { data: user } = await step.run("get-github-user", async () => {
      try {
        return await octokit.rest.users.getAuthenticated();
      } catch (error) {
        // Permanent auth failures (401/403) fail fast instead of retrying.
        toNonRetriableIfPermanent(error);
      }
    });

    // Create the new repository with auto_init to have an initial commit
    const { data: repo } = await step.run("create-repo", async () => {
      try {
        return await octokit.rest.repos.createForAuthenticatedUser({
          name: repoName,
          description: description || `Exported from Prism`,
          private: visibility === "private",
          auto_init: true,
        });
      } catch (error) {
        // A name collision (422) is deterministic — don't burn the retry
        // window on it.
        toNonRetriableIfPermanent(error);
      }
    });

    // Wait for GitHub to initialize the repo (auto_init is async on GitHub's side)
    await step.sleep("wait-for-repo-init", "3s");

    // Get the initial commit SHA (we need this as parent for our commit)
    const initialCommitSha = await step.run("get-initial-commit", async () => {
      const { data: ref } = await octokit.rest.git.getRef({
        owner: user.login,
        repo: repoName,
        ref: `heads/${repo.default_branch}`,
      });
      return ref.object.sha;
    });

    // Fetch lightweight file metadata (no content) to build paths.
    const manifest = await step.run("fetch-project-manifest", async () => {
      return (await convex.query(api.system.getProjectFileManifest, {
        internalKey,
        projectId,
      })) as ManifestFile[];
    });

    // Build a map of file IDs to their full paths
    const buildFilePaths = (files: ManifestFile[]) => {
      const fileMap = new Map<Id<"files">, ManifestFile>();
      files.forEach((f) => fileMap.set(f._id, f));

      const getFullPath = (file: ManifestFile): string => {
        if (!file.parentId) {
          return file.name;
        }

        const parent = fileMap.get(file.parentId);

        if (!parent) {
          return file.name;
        }

        return `${getFullPath(parent)}/${file.name}`;
      };

      const paths: Record<string, ManifestFile> = {};
      files.forEach((file) => {
        paths[getFullPath(file)] = file;
      });

      return paths;
    };

    const filePaths = buildFilePaths(manifest);

    // Filter to only actual files (not folders)
    const fileEntries = Object.entries(filePaths).filter(
      ([, file]) => file.type === "file",
    );

    if (fileEntries.length === 0) {
      throw new NonRetriableError("No files to export");
    }

    // Create blobs in bounded batches. Each batch fetches file content per-file
    // and returns only { path, sha } so no step output carries file bodies.
    // GitHub blob creation is content-addressed, so batch retries are idempotent.
    const BATCH_SIZE = 20;
    const treeItems: TreeItem[] = [];

    for (let i = 0; i < fileEntries.length; i += BATCH_SIZE) {
      const batch = fileEntries.slice(i, i + BATCH_SIZE);
      const batchItems = await step.run(
        `create-blobs-${i / BATCH_SIZE}`,
        async () => {
          const items: TreeItem[] = [];

          for (const [path, manifestFile] of batch) {
            const file = await convex.query(api.system.getFileWithUrl, {
              internalKey,
              fileId: manifestFile._id,
            });

            if (!file) {
              continue;
            }

            let content: string;
            let encoding: "utf-8" | "base64" = "utf-8";

            if (file.content !== null) {
              // Text file
              content = file.content;
            } else if (file.storageUrl) {
              // Binary file - fetch and base64 encode
              const response = await ky.get(file.storageUrl);
              const buffer = Buffer.from(await response.arrayBuffer());
              content = buffer.toString("base64");
              encoding = "base64";
            } else {
              // Skip files with no content
              continue;
            }

            const { data: blob } = await octokit.rest.git.createBlob({
              owner: user.login,
              repo: repoName,
              content,
              encoding,
            });

            items.push({
              path,
              mode: "100644",
              type: "blob",
              sha: blob.sha,
            });
          }

          return items;
        },
      );

      treeItems.push(...batchItems);
    }

    if (treeItems.length === 0) {
      throw new NonRetriableError("Failed to create any file blobs");
    }

    // Create the tree
    const { data: tree } = await step.run("create-tree", async () => {
      return await octokit.rest.git.createTree({
        owner: user.login,
        repo: repoName,
        tree: treeItems,
      });
    });

    // Create the commit with the initial commit as parent
    const { data: commit } = await step.run("create-commit", async () => {
      return await octokit.rest.git.createCommit({
        owner: user.login,
        repo: repoName,
        message: "Initial commit from Prism",
        tree: tree.sha,
        parents: [initialCommitSha],
      });
    });

    // Update the main branch reference to point to our new commit
    await step.run("update-branch-ref", async () => {
      return await octokit.rest.git.updateRef({
        owner: user.login,
        repo: repoName,
        ref: `heads/${repo.default_branch}`,
        sha: commit.sha,
        force: true,
      });
    });

    // Set status to completed with repo URL
    await step.run("set-completed-status", async () => {
      await convex.mutation(api.system.updateExportStatus, {
        internalKey,
        projectId,
        status: "completed",
        repoUrl: repo.html_url,
      });
    });

    return {
      success: true,
      repoUrl: repo.html_url,
      filesExported: treeItems.length,
    };
  },
);
