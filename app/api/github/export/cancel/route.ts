import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { convex } from "@/lib/convex-client";
import { inngest } from "@/inngest/client";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const requestSchema = z.object({
  projectId: z.string(),
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId } = requestSchema.parse(body);

  const internalKey = process.env.PRISM_CONVEX_INTERNAL_KEY;

  if (!internalKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  // Verify the authenticated user owns this project before acting on it.
  const project = await convex.query(api.system.getOwnedProject, {
    internalKey,
    projectId: projectId as Id<"projects">,
    ownerId: userId,
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const event = await inngest.send({
    name: "github/export.cancel",
    data: {
      projectId,
    },
  });

  // Update status to cancelled. This is now guarded in updateExportStatus so it
  // only applies while a run is actually "exporting".
  // NOTE: If the run had already created the GitHub repo, that repo is left in
  // place intentionally — deleting a user's repo as a cancellation side effect
  // is more dangerous than leaving an empty one, and would require the
  // delete_repo OAuth scope we don't request.
  await convex.mutation(api.system.updateExportStatus, {
    internalKey,
    projectId: projectId as Id<"projects">,
    status: "cancelled",
  });

  return NextResponse.json({
    success: true,
    projectId,
    eventId: event.ids[0],
  });
}
