import { NextResponse } from "next/server";
import { saveFeedback, appendToKnowledge } from "@/lib/ai/knowledge";
import { z } from "zod";

const feedbackSchema = z.object({
  type: z.enum(["correction", "preference", "insight", "bug"]),
  topic: z.string().min(1),
  content: z.string().min(1),
  source: z.string().optional(),
  // Optional: also append to a specific knowledge file (permanent)
  appendToFile: z.string().optional(),
});

/**
 * POST /api/feedback
 * Save user feedback that the agent will reference in future conversations.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { appendToFile, ...entry } = parsed.data;

    // Save to feedback log (rolling log)
    saveFeedback(entry);

    // Optionally also append to a permanent markdown file
    if (appendToFile) {
      const content = `## ${entry.topic}\n\n**Type:** ${entry.type}\n\n${entry.content}${entry.source ? `\n\n**Source:** ${entry.source}` : ""}`;
      appendToKnowledge(appendToFile, content);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
