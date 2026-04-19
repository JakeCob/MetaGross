import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { fetchUrl } from "@/lib/search/fetch-url";

/**
 * fetch_url — grab the actual content behind a URL the agent found
 * via search_web. Without this, the agent sees "YouTube: Wolfe vs
 * Giovanni" and stops — it has a link but no team details. With
 * this, it can pull the video description / Reddit thread body /
 * blog article and extract the 6 Pokemon.
 */
export const fetchUrlTool = new DynamicStructuredTool({
  name: "fetch_url",
  description:
    "Fetch the actual content behind a URL — YouTube (title + description), Reddit (post body + top comments), or any webpage (stripped text). Use this AFTER search_web when a search result looks promising; don't just cite URLs without reading them. Excerpts are capped around 6000 chars.",
  schema: z.object({
    url: z.string().url().describe("Full URL to fetch."),
  }),
  func: async ({ url }) => {
    const result = await fetchUrl(url);
    if (!result) {
      return JSON.stringify({ error: "Invalid URL" });
    }
    return JSON.stringify(result);
  },
});
