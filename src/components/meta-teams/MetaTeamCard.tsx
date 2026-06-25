import { Badge } from "@/components/ui/badge";
import { PokemonSprite } from "@/components/pokemon-sprite";
import type { MetaTeam } from "@/lib/meta-teams/types";

const SOURCE_LABEL: Record<MetaTeam["source"], string> = {
  pikalytics: "Pikalytics",
  limitless: "Limitless",
  smogon: "Smogon",
  reddit: "Reddit",
  user: "Community",
  creator: "Creator",
  vgcpastes: "VGCPastes",
  victoryroad: "Victory Road",
  labmaus: "Labmaus",
};

const SOURCE_VARIANT: Record<
  MetaTeam["source"],
  "info" | "success" | "warning" | "outline"
> = {
  pikalytics: "success",
  limitless: "info",
  smogon: "info",
  reddit: "warning",
  user: "outline",
  creator: "success",
  vgcpastes: "info",
  victoryroad: "warning",
  labmaus: "info",
};

/** Compact card showing a known meta team. Used on match lists, browse, etc. */
export function MetaTeamCard({ team }: { team: MetaTeam }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={SOURCE_VARIANT[team.source]} className="text-[10px]">
          {SOURCE_LABEL[team.source]}
        </Badge>
        {team.author && (
          <span className="text-xs font-semibold text-foreground">
            {team.author}
          </span>
        )}
        {team.record && (
          <span className="text-xs text-muted-foreground">{team.record}</span>
        )}
        {team.archetype && (
          <span className="text-xs text-muted-foreground italic">
            {team.archetype}
          </span>
        )}
        {team.sourceUrl && (
          <a
            href={team.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[11px] text-primary hover:underline"
          >
            source →
          </a>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {team.species.map((sp, i) => (
          <div
            key={`${sp}-${i}`}
            className="flex items-center gap-1 rounded bg-muted/30 px-1.5 py-0.5"
          >
            <PokemonSprite species={sp} size={20} />
            <span className="text-[11px] text-foreground">{sp}</span>
          </div>
        ))}
      </div>
      {team.description && (
        <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">
          {team.description}
        </p>
      )}
    </div>
  );
}
