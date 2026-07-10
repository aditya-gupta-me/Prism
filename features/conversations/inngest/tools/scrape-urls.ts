import { z } from "zod";
import { createTool } from "@inngest/agent-kit";
import { firecrawl } from "@/lib/firecrawl";

const paramsSchema = z.object({
  urls: z
    .array(z.url("Invalid URL format"))
    .min(1, "Provide at least one URL to scrape"),
});

export const createScrapeUrlsTool = () => {
  return createTool({
    name: "scrapeUrls",
    description:
      "Scrape content from URLs to get documentation or reference material. Use this when the user provides URLs or references external documentation. Returns markdown content from the scraped pages. At most 3 URLs are scraped per call and each result is truncated to ~8000 characters.",
    parameters: z.object({
      urls: z.array(z.string()).describe("Array of URLs to scrape for content"),
    }),
    handler: async (params, { step: toolStep }) => {
      const parsed = paramsSchema.safeParse(params);
      if (!parsed.success) {
        return `Error: ${parsed.error.issues[0].message}`;
      }

      // Cap the number of URLs and the size of each result to bound cost and
      // keep the tool output within the model's context budget.
      const MAX_URLS = 3;
      const MAX_CONTENT_LENGTH = 8000;
      const urls = parsed.data.urls.slice(0, MAX_URLS);

      try {
        return await toolStep?.run("scrape-urls", async () => {
          const results: { url: string; content: string }[] = [];

          for (const url of urls) {
            try {
              const result = await firecrawl.scrape(url, {
                formats: ["markdown"],
              });

              if (result.markdown) {
                results.push({
                  url,
                  content: result.markdown.slice(0, MAX_CONTENT_LENGTH),
                });
              }
            } catch {
              results.push({
                url,
                content: `Failed to scrape URL: ${url}`,
              });
            }
          }

          if (results.length === 0) {
            return "No content could be scraped from the provided URLs.";
          }

          return JSON.stringify(results);
        });
      } catch (error) {
        return `Error scraping URLs: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });
};
