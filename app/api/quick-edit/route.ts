import { z } from "zod";
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { google } from "@ai-sdk/google";

const quickEditSchema = z.object({
  editedCode: z
    .string()
    .describe(
      "The edited version of the selected code based on the instruction",
    ),
});

const URL_REGEX = /https?:\/\/[^\s)>\]]+/g;

const QUICK_EDIT_PROMPT = `You are a code editing assistant. Edit the selected code based on the user's instruction.

<context>
<selected_code>
{selectedCode}
</selected_code>
<full_code_context>
{fullCode}
</full_code_context>
</context>

{documentation}

<instruction>
{instruction}
</instruction>

<instructions>
Return ONLY the edited version of the selected code.
Maintain the same indentation level as the original.
Do not include any explanations or comments unless requested.
If the instruction is unclear or cannot be applied, return the original code unchanged.
</instructions>`;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const { selectedCode, fullCode, instruction } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!selectedCode) {
      return NextResponse.json(
        { error: "Selected code is required" },
        { status: 400 },
      );
    }

    if (!instruction) {
      return NextResponse.json(
        { error: "Instruction is required" },
        { status: 400 },
      );
    }

    const urls = Array.from(new Set(instruction.match(URL_REGEX) ?? [])).slice(
      0,
      3,
    );

    let documentationContext = "";

    if (urls.length > 0) {
      // Only load Firecrawl if URL scraping is actually needed.
      if (!process.env.FIRECRAWL_API_KEY) {
        return NextResponse.json(
          {
            error:
              "URL scraping is unavailable because Firecrawl is not configured.",
          },
          { status: 503 },
        );
      }

      const { firecrawl } = await import("@/lib/firecrawl");

      const scrapedResults = await Promise.all(
        urls.map(async (url: string) => {
          try {
            const result = await firecrawl.scrape(url, {
              formats: ["markdown"],
            });

            if (result.markdown) {
              return `<doc url="${url}">\n${result.markdown}\n</doc>`;
            }

            return null;
          } catch (error) {
            console.error(`Failed to scrape ${url}:`, error);
            return null;
          }
        }),
      );

      const validResults = scrapedResults.filter(
        (result): result is string => result !== null,
      );

      if (validResults.length > 0) {
        documentationContext = `<documentation>\n${validResults.join(
          "\n\n",
        )}\n</documentation>`;
      }
    }

    const prompt = QUICK_EDIT_PROMPT.replace("{selectedCode}", selectedCode)
      .replace("{fullCode}", fullCode || "")
      .replace("{instruction}", instruction)
      .replace("{documentation}", documentationContext);

    const { output } = await generateText({
      model: google("gemini-2.5-flash-lite"),
      output: Output.object({
        schema: quickEditSchema,
      }),
      prompt,
    });

    return NextResponse.json({
      editedCode: output.editedCode,
    });
  } catch (error) {
    console.error("Edit error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate edit",
      },
      { status: 500 },
    );
  }
}
