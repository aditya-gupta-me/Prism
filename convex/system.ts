import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const validateInternalKey = (key: string) => {
  const internalKey = process.env.PRISM_CONVEX_INTERNAL_KEY;

  if (!internalKey) {
    throw new Error("PRISM_CONVEX_INTERNAL_KEY is not configured");
  }

  if (key !== internalKey) {
    throw new Error("Invalid internal key");
  }
};

// Ownership-checked project lookup for job-triggering routes and Inngest
// execution-time re-verification. Returns null (not throw) so callers can
// map to a 404 without leaking whether the ID exists.
export const getOwnedProject = query({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    ownerId: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.ownerId !== args.ownerId) {
      return null;
    }
    return project;
  },
});

// Ownership-checked conversation lookup (verifies the conversation's project
// is owned by ownerId). Returns null on any miss.
export const getOwnedConversation = query({
  args: {
    internalKey: v.string(),
    conversationId: v.id("conversations"),
    ownerId: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    const project = await ctx.db.get(conversation.projectId);
    if (!project || project.ownerId !== args.ownerId) {
      return null;
    }
    return conversation;
  },
});

const MAX_USER_MESSAGES_PER_HOUR = 30;

// Atomically prepares a message run for a project. In one serializable
// transaction it: verifies ownership, enforces a per-project hourly rate cap,
// supersedes (cancels) any in-flight processing message, and creates the user
// message + assistant placeholder. Convex OCC serializes concurrent callers, so
// at most one "processing" message per project survives — the single-flight
// invariant no longer depends on a racy read-then-act in the route.
export const prepareMessageRun = mutation({
  args: {
    internalKey: v.string(),
    conversationId: v.id("conversations"),
    ownerId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return { ok: false as const, error: "not_found" as const };
    }
    const project = await ctx.db.get(conversation.projectId);
    if (!project || project.ownerId !== args.ownerId) {
      return { ok: false as const, error: "not_found" as const };
    }

    // Bounded recency read — never scans the whole table.
    const recent = await ctx.db
      .query("messages")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .order("desc")
      .take(80);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentUserCount = recent.filter(
      (m) => m.role === "user" && m._creationTime > oneHourAgo,
    ).length;
    if (recentUserCount >= MAX_USER_MESSAGES_PER_HOUR) {
      return { ok: false as const, error: "rate_limited" as const };
    }

    // Atomic supersede: serializability guarantees at most one "processing"
    // message per project after this transaction commits.
    const processing = await ctx.db
      .query("messages")
      .withIndex("by_project_status", (q) =>
        q.eq("projectId", project._id).eq("status", "processing"),
      )
      .collect();
    for (const msg of processing) {
      await ctx.db.patch(msg._id, { status: "cancelled" as const });
    }

    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      projectId: project._id,
      role: "user" as const,
      content: args.message,
    });
    const assistantMessageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      projectId: project._id,
      role: "assistant" as const,
      content: "",
      status: "processing" as const,
    });
    await ctx.db.patch(args.conversationId, { updatedAt: Date.now() });

    return {
      ok: true as const,
      assistantMessageId,
      projectId: project._id,
      supersededMessageIds: processing.map((m) => m._id),
    };
  },
});

export const updateMessageContent = mutation({
  args: {
    internalKey: v.string(),
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return { applied: false as const, reason: "not_found" as const };
    }
    // Only a processing message may complete. A cancelled or already-completed
    // message is never overwritten by a late-finishing / superseded run.
    if (message.status !== "processing") {
      return { applied: false as const, reason: "not_processing" as const };
    }

    await ctx.db.patch(args.messageId, {
      content: args.content,
      status: "completed" as const,
    });
    return { applied: true as const };
  },
});

export const updateMessageStatus = mutation({
  args: {
    internalKey: v.string(),
    messageId: v.id("messages"),
    status: v.union(v.literal("completed"), v.literal("cancelled")),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const message = await ctx.db.get(args.messageId);
    // Terminal states are only reachable from "processing"; anything else is
    // a no-op so late/duplicate transitions cannot flip a settled message.
    if (!message || message.status !== "processing") {
      return { applied: false as const };
    }

    await ctx.db.patch(args.messageId, {
      status: args.status,
    });
    return { applied: true as const };
  },
});

export const getProcessingMessages = query({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    return await ctx.db
      .query("messages")
      .withIndex("by_project_status", (q) =>
        q.eq("projectId", args.projectId).eq("status", "processing"),
      )
      .collect();
  },
});

// Used for Agent conversation context
export const getRecentMessages = query({
  args: {
    internalKey: v.string(),
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const limit = Math.min(args.limit ?? 10, 50);

    // Read only the most recent `limit` rows via the index instead of
    // collecting the entire conversation and slicing in JS.
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .take(limit);

    // Return chronological (ascending) to preserve the previous contract.
    return messages.reverse();
  },
});

// Used for Agent to update conversation title
export const updateConversationTitle = mutation({
  args: {
    internalKey: v.string(),
    conversationId: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    await ctx.db.patch(args.conversationId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

// Used for Agent "ListFiles" tool
export const getProjectFiles = query({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    return await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// Used for Agent "ReadFiles" tool
export const getFileById = query({
  args: {
    internalKey: v.string(),
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    return await ctx.db.get(args.fileId);
  },
});

// Used for Agent "UpdateFile" tool
export const updateFile = mutation({
  args: {
    internalKey: v.string(),
    fileId: v.id("files"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const file = await ctx.db.get(args.fileId);

    if (!file) {
      throw new Error("File not found");
    }

    await ctx.db.patch(args.fileId, {
      content: args.content,
      updatedAt: Date.now(),
    });

    return args.fileId;
  },
});

// Used for Agent "CreateFile" tool (agent path does not pass upsert, so its
// "already exists" error behavior is unchanged). Import passes upsert:true so
// a retry after a partial failure overwrites in place instead of throwing.
export const createFile = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    name: v.string(),
    content: v.string(),
    parentId: v.optional(v.id("files")),
    upsert: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId),
      )
      .collect();

    const existing = files.find(
      (file) => file.name === args.name && file.type === "file",
    );

    if (existing) {
      if (!args.upsert) {
        throw new Error("File already exists");
      }
      if (existing.storageId) {
        await ctx.storage.delete(existing.storageId);
      }
      await ctx.db.patch(existing._id, {
        content: args.content,
        storageId: undefined,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    const fileId = await ctx.db.insert("files", {
      projectId: args.projectId,
      name: args.name,
      content: args.content,
      type: "file",
      parentId: args.parentId,
      updatedAt: Date.now(),
    });

    return fileId;
  },
});

// Used for Agent bulk "CreateFiles" tool
export const createFiles = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
    files: v.array(
      v.object({
        name: v.string(),
        content: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const existingFiles = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId),
      )
      .collect();

    const results: { name: string; fileId: string; error?: string }[] = [];

    for (const file of args.files) {
      const existing = existingFiles.find(
        (f) => f.name === file.name && f.type === "file",
      );

      if (existing) {
        results.push({
          name: file.name,
          fileId: existing._id,
          error: "File already exists",
        });
        continue;
      }

      const fileId = await ctx.db.insert("files", {
        projectId: args.projectId,
        name: file.name,
        content: file.content,
        type: "file",
        parentId: args.parentId,
        updatedAt: Date.now(),
      });

      results.push({ name: file.name, fileId });
    }

    return results;
  },
});

// Used for Agent "CreateFolder" tool. Import passes upsert:true so a retry
// re-resolves the existing folder id instead of throwing.
export const createFolder = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    name: v.string(),
    parentId: v.optional(v.id("files")),
    upsert: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId),
      )
      .collect();

    const existing = files.find(
      (file) => file.name === args.name && file.type === "folder",
    );

    if (existing) {
      if (!args.upsert) {
        throw new Error("Folder already exists");
      }
      return existing._id;
    }

    const fileId = await ctx.db.insert("files", {
      projectId: args.projectId,
      name: args.name,
      type: "folder",
      parentId: args.parentId,
      updatedAt: Date.now(),
    });

    return fileId;
  },
});

// Used for Agent "RenameFile" tool
export const renameFile = mutation({
  args: {
    internalKey: v.string(),
    fileId: v.id("files"),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Check if a file with the new name already exists in the same parent folder
    const siblings = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", file.projectId).eq("parentId", file.parentId),
      )
      .collect();

    const existing = siblings.find(
      (sibling) =>
        sibling.name === args.newName &&
        sibling.type === file.type &&
        sibling._id !== args.fileId,
    );

    if (existing) {
      throw new Error(`A ${file.type} named "${args.newName}" already exists`);
    }

    await ctx.db.patch(args.fileId, {
      name: args.newName,
      updatedAt: Date.now(),
    });

    return args.fileId;
  },
});

// Used for Agent "DeleteFile" tool
export const deleteFile = mutation({
  args: {
    internalKey: v.string(),
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Recursively delete file/folder and all descendants
    const deleteRecursive = async (fileId: typeof args.fileId) => {
      const item = await ctx.db.get(fileId);

      if (!item) {
        return;
      }

      // If it's a folder, delete all children first
      if (item.type === "folder") {
        const children = await ctx.db
          .query("files")
          .withIndex("by_project_parent", (q) =>
            q.eq("projectId", item.projectId).eq("parentId", fileId),
          )
          .collect();

        for (const child of children) {
          await deleteRecursive(child._id);
        }
      }

      // Delete storage file if it exists
      if (item.storageId) {
        await ctx.storage.delete(item.storageId);
      }

      // Delete the file/folder itself
      await ctx.db.delete(fileId);
    };

    await deleteRecursive(args.fileId);

    return args.fileId;
  },
});

// Paginated so a large project is cleaned across several bounded transactions
// (a single all-rows delete can exceed Convex's per-transaction write limits).
// The caller loops until hasMore is false.
export const cleanup = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const limit = Math.min(args.limit ?? 200, 500);

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(limit);

    for (const file of files) {
      // Delete storage file if it exists
      if (file.storageId) {
        await ctx.storage.delete(file.storageId);
      }

      await ctx.db.delete(file._id);
    }

    return { deleted: files.length, hasMore: files.length === limit };
  },
});

export const generateUploadUrl = mutation({
  args: {
    internalKey: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createBinaryFile = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    name: v.string(),
    storageId: v.id("_storage"),
    parentId: v.optional(v.id("files")),
    upsert: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId),
      )
      .collect();

    const existing = files.find(
      (file) => file.name === args.name && file.type === "file",
    );

    if (existing) {
      if (!args.upsert) {
        throw new Error("File already exists");
      }
      if (existing.storageId) {
        await ctx.storage.delete(existing.storageId);
      }
      await ctx.db.patch(existing._id, {
        storageId: args.storageId,
        content: undefined,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    const fileId = await ctx.db.insert("files", {
      projectId: args.projectId,
      name: args.name,
      type: "file",
      storageId: args.storageId,
      parentId: args.parentId,
      updatedAt: Date.now(),
    });

    return fileId;
  },
});

export const updateImportStatus = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    status: v.optional(
      v.union(
        v.literal("importing"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    await ctx.db.patch("projects", args.projectId, {
      importStatus: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const updateExportStatus = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    status: v.optional(
      v.union(
        v.literal("exporting"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("cancelled"),
      ),
    ),
    repoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return { applied: false as const };
    }

    const current = project.exportStatus;
    const terminal = ["completed", "failed", "cancelled"] as const;

    // A terminal state (and clearing to undefined) is only reachable from an
    // in-flight "exporting" run. This stops a late cancel from flipping a
    // finished export, and stops cancel/reset from stamping a status onto a
    // project that isn't exporting.
    if (
      args.status &&
      terminal.includes(args.status as (typeof terminal)[number]) &&
      current !== "exporting"
    ) {
      return { applied: false as const };
    }
    if (args.status === undefined && current === "exporting") {
      return { applied: false as const };
    }

    await ctx.db.patch("projects", args.projectId, {
      exportStatus: args.status,
      exportRepoUrl: args.repoUrl,
      updatedAt: Date.now(),
    });
    return { applied: true as const };
  },
});

// Lightweight file metadata for the whole project (no content). Used by export
// to build paths without pulling every file body into one step output.
export const getProjectFileManifest = query({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return files.map((f) => ({
      _id: f._id,
      name: f.name,
      type: f.type,
      parentId: f.parentId,
    }));
  },
});

// Single file with its content and (for binary files) a resolved storage URL.
// Fetched per-file inside batched export steps.
export const getFileWithUrl = query({
  args: {
    internalKey: v.string(),
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      return null;
    }

    const storageUrl = file.storageId
      ? await ctx.storage.getUrl(file.storageId)
      : null;

    return {
      _id: file._id,
      name: file.name,
      type: file.type,
      content: file.content ?? null,
      storageUrl,
    };
  },
});

export const createProject = mutation({
  args: {
    internalKey: v.string(),
    name: v.string(),
    ownerId: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      ownerId: args.ownerId,
      updatedAt: Date.now(),
      importStatus: "importing",
    });

    return projectId;
  },
});
