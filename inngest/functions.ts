// src/inngest/functions.ts
import { inngest } from "./client";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export const demoGenerate = inngest.createFunction(
  { id: "demo-generate" },
  { event: "demo/generate" },
  async ({ step }) => {
    await step.run("generate-text", async () => {
      return await generateText({
        model: google("gemini-3.5-flash"),
        prompt: "Write Python code for Binary Search.",
      });
    });
  },
);
