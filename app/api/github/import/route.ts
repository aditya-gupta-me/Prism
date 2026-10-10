import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { convex } from "@/lib/convex-client";
import { inngest } from "@/inngest/client";
import { getGithubTokenForUser } from "@/lib/github-token";

import { api } from "@/convex/_generated/api";

const requestSchema = z.object({
  url: z.url(),
});

function parseGitHubUrl(input: string) {
  const u = new URL(input);

  if (u.hostname !== "github.com" && u.hostname !== "www.github.com") {
    return null;
  }

  const [owner, repo] = u.pathname
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);

  if (!owner || !repo) {
    return null;
  }

  return { owner, repo: repo.replace(/\.git$/, "") };
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { url } = requestSchema.parse(body);

  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });
  }

  const { owner, repo } = parsed;

  // Fail-fast UX check. The token is NOT forwarded in the event payload;
  // the Inngest function fetches its own fresh token at execution time.
  const githubToken = await getGithubTokenForUser(userId);

  if (!githubToken) {
    return NextResponse.json(
      { error: "GitHub not connected. Please reconnect your GitHub account." },
      { status: 400 },
    );
  }

  const internalKey = process.env.PRISM_CONVEX_INTERNAL_KEY;

  if (!internalKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const projectId = await convex.mutation(api.system.createProject, {
    internalKey,
    name: repo,
    ownerId: userId,
  });

  // The project is created with importStatus "importing". If the event fails to
  // send, no run will ever exist to clear it — so compensate by marking failed.
  try {
    const event = await inngest.send({
      name: "github/import.repo",
      data: {
        owner,
        repo,
        projectId,
        userId,
      },
    });

    return NextResponse.json({
      success: true,
      projectId,
      eventId: event.ids[0],
    });
  } catch {
    await convex.mutation(api.system.updateImportStatus, {
      internalKey,
      projectId,
      status: "failed",
    });
    return NextResponse.json(
      { error: "Failed to start import" },
      { status: 502 },
    );
  }
}
