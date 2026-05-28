// src/inngest/functions.ts
import { inngest } from "./client";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { firecrawl } from "@/lib/firecrawl";

const URL_REGEX = /https?:\/\/[^\s]+/g;

export const demoGenerate = inngest.createFunction(
  { id: "demo-generate" },
  { event: "demo/generate" },
  async ({ event, step }) => {
    const { prompt } = event.data as { prompt: string };

    const urls = (await step.run("exctract-urls", async () => {
      return prompt.match(URL_REGEX) ?? [];
    }
    const { prompt } = event.data as { prompt: string };

    const urls = (await step.run("extract-urls", async () => {
      return prompt.match(URL_REGEX) ?? [];
    })) as string[];

    const scrapedContent = await step.run("scrape-urls", async () => {
      const results = await Promise.all(
        urls.map(async (url) => {
          try {
            const result = await firecrawl.scrape(url, { formats: ["markdown"] });
            return result.markdown ?? null;
          } catch {
            return null;
          }
        }),
      );
      return results.filter(Boolean).join("\n\n");

    await step.run("generate-text", async () => {
      return await generateText({
        model: google("gemini-3.5-flash"),
        prompt: finalPrompt,
      });
    });
  },

    await step.run("generate-text", async () => {
      return await generateText({
        model: google("gemini-1.5-flash"),
        prompt: finalPrompt,
      });
    });
