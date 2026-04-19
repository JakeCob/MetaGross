import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";

const ReportSchema = z.object({
  slug: z.string().min(2).max(80),
  title: z.string(),
  archetype: z.string().optional(),
  overview: z.string().optional(),
  pokemon: z
    .array(
      z.object({
        species: z.string(),
        item: z.string().optional(),
        ability: z.string().optional(),
        nature: z.string().optional(),
        teraType: z.string().optional(),
        moves: z.array(z.string()).optional(),
        evs: z.string().optional(),
        role: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .min(1)
    .max(6),
  gamePlan: z.string().optional(),
  matchups: z
    .array(
      z.object({
        vs: z.string(),
        leads: z.string().optional(),
        plan: z.string(),
      }),
    )
    .optional(),
  damageCalcs: z
    .array(
      z.object({
        attacker: z.string(),
        move: z.string(),
        defender: z.string(),
        result: z.string(),
      }),
    )
    .optional(),
  winConditions: z.array(z.string()).optional(),
  commonMistakes: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  author: z.string().optional().default("MetaGross Agent"),
});

type ReportInput = z.infer<typeof ReportSchema>;

/**
 * write_team_report
 *
 * Produces a structured markdown team deliverable under
 * `data/md/Teambuilding/` — the format Claude used for Jacob's
 * hand-crafted reports (counter teams, Scovillain playbook,
 * tournament intel, custom builds pack). Lets the agent ship a
 * coach-quality artifact at the end of a team-building session.
 *
 * The output file path + a preview of the written content are
 * returned so the UI can render a "📄 Saved report" link.
 *
 * Treated as a read/safe tool (no approval gate) because it only
 * adds new files under a scoped artifact directory. Pokepaste,
 * EVs, and game plan are the agent's responsibility — this tool
 * just serializes them.
 */
export const writeTeamReportTool = new DynamicStructuredTool({
  name: "write_team_report",
  description:
    "Save a structured team-building report as a markdown file under data/md/Teambuilding/. Use this after a full team-building session to produce a coach-quality deliverable the user can reference later. Pass the team, EVs, game plan, matchup notes, and optional damage calcs — the tool formats and writes. Returns the saved file path + preview.",
  schema: ReportSchema,
  func: async (input) => {
    const slug = slugify(input.slug);
    if (!slug) {
      return JSON.stringify({ error: "slug required (non-empty)" });
    }

    const md = renderMarkdown(input);
    const relPath = path.join("data", "md", "Teambuilding", `${slug}.md`);
    const absDir = path.join(process.cwd(), "data", "md", "Teambuilding");
    const absPath = path.join(absDir, `${slug}.md`);

    try {
      await fs.mkdir(absDir, { recursive: true });
      await fs.writeFile(absPath, md, "utf-8");
    } catch (err) {
      return JSON.stringify({
        error: "Failed to write report",
        message: err instanceof Error ? err.message : String(err),
      });
    }

    return JSON.stringify({
      savedAt: relPath,
      bytes: Buffer.byteLength(md, "utf-8"),
      preview: md.slice(0, 800) + (md.length > 800 ? "\n…[truncated]" : ""),
    });
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function renderMarkdown(input: ReportInput): string {
  const lines: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  lines.push(`# ${input.title}`);
  lines.push("");
  const attribution = [input.author ?? "MetaGross Agent", today].join(" · ");
  lines.push(`_${attribution}_`);
  if (input.archetype) {
    lines.push("");
    lines.push(`**Archetype:** ${input.archetype}`);
  }

  if (input.overview) {
    lines.push("");
    lines.push("## Overview");
    lines.push("");
    lines.push(input.overview.trim());
  }

  lines.push("");
  lines.push("## Team");
  for (const p of input.pokemon) {
    lines.push("");
    const header = p.role ? `${p.species} — ${p.role}` : p.species;
    lines.push(`### ${header}`);
    if (p.item) lines.push(`- **Item**: ${p.item}`);
    if (p.ability) lines.push(`- **Ability**: ${p.ability}`);
    if (p.nature) lines.push(`- **Nature**: ${p.nature}`);
    if (p.teraType) lines.push(`- **Tera**: ${p.teraType}`);
    if (p.moves && p.moves.length > 0) {
      lines.push(`- **Moves**: ${p.moves.join(" / ")}`);
    }
    if (p.evs) lines.push(`- **EVs / Points**: ${p.evs}`);
    if (p.notes) {
      lines.push("");
      lines.push(p.notes.trim());
    }
  }

  if (input.gamePlan) {
    lines.push("");
    lines.push("## Game Plan");
    lines.push("");
    lines.push(input.gamePlan.trim());
  }

  if (input.winConditions && input.winConditions.length > 0) {
    lines.push("");
    lines.push("## Win Conditions");
    for (const wc of input.winConditions) lines.push(`- ${wc}`);
  }

  if (input.matchups && input.matchups.length > 0) {
    lines.push("");
    lines.push("## Matchups");
    for (const m of input.matchups) {
      lines.push("");
      lines.push(`### vs ${m.vs}`);
      if (m.leads) lines.push(`**Leads**: ${m.leads}`);
      lines.push("");
      lines.push(m.plan.trim());
    }
  }

  if (input.damageCalcs && input.damageCalcs.length > 0) {
    lines.push("");
    lines.push("## Damage Calcs");
    lines.push("");
    lines.push("| Attacker | Move | Defender | Result |");
    lines.push("|---|---|---|---|");
    for (const c of input.damageCalcs) {
      lines.push(
        `| ${escapeCell(c.attacker)} | ${escapeCell(c.move)} | ${escapeCell(c.defender)} | ${escapeCell(c.result)} |`,
      );
    }
  }

  if (input.commonMistakes && input.commonMistakes.length > 0) {
    lines.push("");
    lines.push("## Common Mistakes to Avoid");
    for (const m of input.commonMistakes) lines.push(`- ${m}`);
  }

  if (input.sources && input.sources.length > 0) {
    lines.push("");
    lines.push("## Sources");
    for (const s of input.sources) lines.push(`- ${s}`);
  }

  lines.push("");
  return lines.join("\n");
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n+/g, " ");
}
