// src/inngest/functions.ts
import { inngest } from "./client";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { firecrawl } from "@/lib/firecrawl";

const URL_REGEX = /https?:\/\/[^\s]+/g;
const MAX_SCRAPED_CONTENT_LENGTH = 8000; // Limit scraped content to ~8000 chars to stay within model context limits

export const demoGenerate = inngest.createFunction(
  { id: "demo-generate" },
  { event: "demo/generate" },
  async ({ event, step }) => {
    // Validate event.data.prompt exists and is a string
    if (!event.data || typeof event.data.prompt !== "string") {
      throw new Error("Missing or invalid event.data.prompt: expected a string");
    }
    const { prompt } = event.data as { prompt: string };

    const urls = (await step.run("extract-urls", async () => {
      return prompt.match(URL_REGEX) ?? [];
    })) as string[];

    const scrapedContent =
      urls.length > 0
        ? await step.run("scrape-urls", async () => {
            const results = await Promise.all(
              urls.map(async (url) => {
                try {
                  const result = await firecrawl.scrape(url, {
                    formats: ["markdown"],
                  });
                  return result.markdown ?? null;
                } catch {
                  return null;
                }
              }),
            );
            return results.filter(Boolean).join("\n\n");
          })
        : "";

    // Truncate scraped content to prevent exceeding model context limits
    const truncatedScraped = scrapedContent.slice(0, MAX_SCRAPED_CONTENT_LENGTH);

    const finalPrompt = truncatedScraped
      ? `Context:\n${truncatedScraped}\n\nQuestion: ${prompt}`
      : prompt;

    await step.run("generate-text", async () => {
      return await generateText({
        model: google("gemini-3.5-flash"),
        prompt: finalPrompt,
      });
    });
  },
);
