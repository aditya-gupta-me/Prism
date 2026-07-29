import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { inngest } from "@/inngest/client";
import { convex } from "@/lib/convex-client";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const requestSchema = z.object({
  conversationId: z.string(),
  message: z.string(),
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const internalKey = process.env.PRISM_CONVEX_INTERNAL_KEY;

  if (!internalKey) {
    return NextResponse.json(
      { error: "Internal key not configured" },
      { status: 500 },
    );
  }

  const body = await request.json();
  const { conversationId, message } = requestSchema.parse(body);

  // Atomic claim: ownership check + rate cap + supersede in-flight run + create
  // user message and assistant placeholder, all in one serializable Convex
  // transaction. Two concurrent POSTs for the same project can no longer both
  // see "no processing message" and both proceed.
  const result = await convex.mutation(api.system.prepareMessageRun, {
    internalKey,
    conversationId: conversationId as Id<"conversations">,
    ownerId: userId,
    message,
  });

  if (!result.ok) {
    if (result.error === "rate_limited") {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  // Best-effort stop of superseded runs. The concurrency key on the function is
  // the hard guarantee; these cancel events just end the old runs sooner.
  if (result.supersededMessageIds.length > 0) {
    await inngest.send(
      result.supersededMessageIds.map((messageId) => ({
        name: "message/cancel" as const,
        data: { messageId },
      })),
    );
  }

  // Trigger Inngest to process the message. ownerId rides along so the
  // function can re-verify ownership at execution time (defense in depth
  // against replayed/tampered events).
  try {
    const event = await inngest.send({
      name: "message/sent",
      data: {
        messageId: result.assistantMessageId,
        conversationId,
        projectId: result.projectId,
        ownerId: userId,
        message,
      },
    });

    return NextResponse.json({
      success: true,
      eventId: event.ids[0],
      messageId: result.assistantMessageId,
    });
  } catch {
    // Compensation (MEDIUM-1): the placeholder is already "processing" but no
    // run will ever exist, so settle it here instead of leaving it stuck.
    await convex.mutation(api.system.updateMessageContent, {
      internalKey,
      messageId: result.assistantMessageId,
      content: "Failed to start processing this message. Please try again.",
    });
    return NextResponse.json(
      { error: "Failed to queue message" },
      { status: 502 },
    );
  }
}
