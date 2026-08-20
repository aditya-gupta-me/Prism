import Firecrawl from "@mendable/firecrawl-js";

export function getFirecrawl(): Firecrawl {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "FIRECRAWL_API_KEY environment variable is required but not set",
    );
  }

  return new Firecrawl({
    apiKey,
  });
}
