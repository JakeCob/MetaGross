/**
 * Reddit VGC team scraper.
 *
 * Reads /r/VGC and /r/stunfisk "new" JSON feeds (no auth required for
 * read-only access), extracts Pokepaste URLs from post titles and
 * bodies, fetches the raw paste, parses to species, and emits
 * ScrapedTeam records.
 *
 * SERVER-ONLY.
 */
import "server-only";

import type { ScraperResult, ScrapedTeam } from "./types";
import {
  extractPokepasteUrls,
  fetchPokepasteRaw,
  parsePokepaste,
} from "./pokepaste";

const SUBREDDITS = ["VGC", "stunfisk"];
const REDDIT_LIMIT = 50;

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    url: string;
    permalink: string;
    author: string;
    created_utc: number;
    link_flair_text: string | null;
  };
}

interface RedditListing {
  data: {
    children: RedditPost[];
  };
}

/**
 * Scrape recent Reddit VGC posts for Pokepaste teams.
 * Uses a politely identified User-Agent and short timeouts. Reddit's
 * new.json returns up to 100 posts per subreddit; we cap at 50 to
 * minimise Pokepaste fetches (one per post with a paste link).
 */
export async function scrapeReddit(): Promise<ScraperResult> {
  const teams: ScrapedTeam[] = [];
  const errors: ScraperResult["errors"] = [];

  for (const sub of SUBREDDITS) {
    const url = `https://www.reddit.com/r/${sub}/new.json?limit=${REDDIT_LIMIT}`;
    let listing: RedditListing;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "metagross-vgc-scout/1.0 (meta-team ingestion)",
          Accept: "application/json",
        },
        // Reddit can stall; don't hang the cron forever.
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        errors.push({ ref: sub, error: `reddit HTTP ${res.status}` });
        continue;
      }
      listing = (await res.json()) as RedditListing;
    } catch (err) {
      errors.push({
        ref: sub,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    for (const post of listing.data.children ?? []) {
      const body = `${post.data.title}\n\n${post.data.selftext}\n\n${post.data.url}`;
      const pasteUrls = extractPokepasteUrls(body);
      if (pasteUrls.length === 0) continue;

      for (const pasteUrl of pasteUrls) {
        try {
          const raw = await fetchPokepasteRaw(pasteUrl);
          if (!raw) continue;
          const parsed = parsePokepaste(raw);
          // Need at least 3 species to be worth storing; under that it's
          // probably a partial paste / damage-calc snippet.
          if (parsed.species.length < 3) continue;

          teams.push({
            source: "reddit",
            sourceRef: `r/${sub}/${post.data.id}::${pasteUrl}`,
            sourceUrl: `https://www.reddit.com${post.data.permalink}`,
            format: "champions-reg-m-a",
            author: post.data.author,
            record: post.data.link_flair_text ?? undefined,
            description:
              post.data.title.length <= 140 ? post.data.title : undefined,
            species: parsed.species,
            pokemon: parsed.pokemon,
            seenAt: post.data.created_utc * 1000,
          });
        } catch (err) {
          errors.push({
            ref: pasteUrl,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  return { name: "reddit", teams, errors };
}
