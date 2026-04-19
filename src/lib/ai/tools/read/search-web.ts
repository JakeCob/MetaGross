import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { searchVGCMeta } from "@/lib/search/index";

export const searchWebTool = new DynamicStructuredTool({
  name: "search_web",
  description:
    "Search the web for VGC meta information, team reports, tournament results, or strategy articles. Returns titles + URLs + snippets — NOT full content. ALWAYS follow up with fetch_url on the top 2-3 results to actually read them before answering the user.",
  schema: z.object({
    query: z
      .string()
      .describe("Search query — be specific about VGC, the format, and what you're looking for"),
  }),
  func: async ({ query }) => {
    const results = await searchVGCMeta(query);

    if (results.length === 0) {
      return JSON.stringify({
        results: [],
        note: "No search results found. Search API keys may not be configured.",
      });
    }

    const sliced = results.slice(0, 5).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      source: r.source,
    }));

    // Inject a next-step directive directly into the tool result. The
    // model reads this immediately during its reasoning loop, which is
    // more reliable than hoping it remembers the distant system-prompt
    // rule about chaining search_web → fetch_url.
    return JSON.stringify({
      results: sliced,
      nextStep:
        "These are SNIPPETS only — not full content. To actually answer the user, call fetch_url on the top 2-3 URLs above. Do NOT cite these URLs in a final answer without fetching them first.",
    });
  },
});
