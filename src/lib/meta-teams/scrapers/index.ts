/**
 * Scraper registry + dispatcher.
 *
 * To add a new source: write a new scraper module exporting an
 * async function that returns ScraperResult, then register it below.
 * The cron endpoint (/api/meta-teams/scrape) walks this list and
 * upserts the aggregated results.
 */
import "server-only";

import { scrapeReddit } from "./reddit";
import { upsertMetaTeam } from "../queries";
import type { ScraperFn, ScraperResult } from "./types";

// ---------------------------------------------------------------------------
// Registry — keep this list explicit so new scrapers are easy to review.
// ---------------------------------------------------------------------------
export const SCRAPERS: Record<string, ScraperFn> = {
  reddit: scrapeReddit,
  // Future: "twitter": scrapeTwitter — needs paid API.
  // Future: "vgc-blogs": scrapeVgcBlogs — source-specific parsers.
};

export interface RunAllOptions {
  /** Restrict to named scrapers; omit to run everything. */
  only?: string[];
}

export interface RunAllResult {
  perScraper: Record<string, ScraperResult>;
  totalTeamsInserted: number;
  totalTeamsSkipped: number;
}

/**
 * Run every registered scraper (or the named subset) and upsert the
 * aggregated teams. Per-scraper failures are isolated — one broken
 * source won't kill the run.
 */
export async function runAllScrapers(
  opts: RunAllOptions = {},
): Promise<RunAllResult> {
  const names = opts.only?.length
    ? opts.only.filter((n) => n in SCRAPERS)
    : Object.keys(SCRAPERS);

  const perScraper: Record<string, ScraperResult> = {};
  let totalTeamsInserted = 0;
  let totalTeamsSkipped = 0;

  for (const name of names) {
    const fn = SCRAPERS[name];
    let result: ScraperResult;
    try {
      result = await fn();
    } catch (err) {
      result = {
        name,
        teams: [],
        errors: [
          {
            ref: "<scraper>",
            error: err instanceof Error ? err.message : String(err),
          },
        ],
      };
    }
    perScraper[name] = result;

    for (const t of result.teams) {
      try {
        await upsertMetaTeam({
          source: t.source,
          sourceRef: t.sourceRef,
          sourceUrl: t.sourceUrl,
          format: t.format ?? "champions-reg-m-a",
          author: t.author,
          record: t.record,
          archetype: t.archetype,
          description: t.description,
          species: t.species,
          pokemon: t.pokemon,
          trust: 0.6,
          seenAt: t.seenAt ?? Date.now(),
        });
        totalTeamsInserted++;
      } catch {
        totalTeamsSkipped++;
      }
    }
  }

  return { perScraper, totalTeamsInserted, totalTeamsSkipped };
}
