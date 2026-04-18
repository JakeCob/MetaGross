/**
 * Scraper registry types.
 *
 * Each scraper is an async function that returns an array of
 * ScrapedTeam records. The cron endpoint dispatches to every
 * registered scraper in sequence and upserts the results.
 */
import type { MetaTeamSource } from "../types";

export interface ScrapedTeam {
  source: MetaTeamSource;
  sourceRef: string;
  sourceUrl?: string;
  format?: string;
  author?: string;
  record?: string;
  archetype?: string;
  description?: string;
  species: string[];
  pokemon?: Array<{
    species: string;
    ability?: string;
    item?: string;
    nature?: string;
    moves?: string[];
    teraType?: string;
  }>;
  seenAt?: number;
}

export interface ScraperResult {
  name: string;
  teams: ScrapedTeam[];
  errors: Array<{ ref: string; error: string }>;
}

export type ScraperFn = () => Promise<ScraperResult>;
