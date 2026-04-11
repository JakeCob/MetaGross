import { getUsageSummary } from "@/lib/ai/rate-limiter";

export async function GET() {
  try {
    const summary = getUsageSummary();
    return Response.json(summary);
  } catch (error) {
    console.error("Usage summary error:", error);
    return Response.json(
      { error: "Failed to get usage summary" },
      { status: 500 },
    );
  }
}
