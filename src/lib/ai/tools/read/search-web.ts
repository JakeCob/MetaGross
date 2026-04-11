import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { searchVGCMeta } from "@/lib/search/index";

export const searchWebTool = new DynamicStructuredTool({
  name: "search_web",
  description:
    "Search the web for VGC meta information, team reports, tournament results, or strategy articles. Returns titles, URLs, and snippets.",
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

    return JSON.stringify(
      results.slice(0, 5).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        source: r.source,
      })),
    );
  },
});
