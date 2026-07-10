// src/app/api/inngest/route.ts
import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import {
  processMessage,
  processMessageCancelled,
} from "@/features/conversations/inngest/process-message";
import { importGithubRepo } from "@/features/projects/inngest/import-github-repo";
import { exportToGithub } from "@/features/projects/inngest/export-to-github";

// Create an API route that serves Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processMessage,
    processMessageCancelled,
    importGithubRepo,
    exportToGithub,
  ],
});
