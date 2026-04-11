"use client";

import ReactMarkdown from "react-markdown";
import { PokemonSprite } from "@/components/pokemon-sprite";
import { Badge } from "@/components/ui/badge";

interface PokemonBlock {
  name: string;
  role?: string;
  ability?: string;
  item?: string;
  moves?: string;
  nature?: string;
  points?: string;
}

/**
 * Parse agent markdown into Pokemon card blocks + regular text blocks.
 * Detects `### Pokemon Name` followed by `- **Key**: Value` lines.
 * All field lines consumed by a card are REMOVED from text output to avoid duplication.
 */
function parseContent(content: string): Array<{ type: "text"; text: string } | { type: "pokemon"; data: PokemonBlock }> {
  const blocks: Array<{ type: "text"; text: string } | { type: "pokemon"; data: PokemonBlock }> = [];

  // Split on ### headers
  const parts = content.split(/(?=^### )/m);

  for (const part of parts) {
    const headerMatch = part.match(/^### (.+)/);
    if (!headerMatch) {
      if (part.trim()) {
        blocks.push({ type: "text", text: part.trim() });
      }
      continue;
    }

    const name = headerMatch[1].trim();
    const lines = part.split("\n").slice(1);

    const data: PokemonBlock = { name };
    const extraLines: string[] = [];

    for (const line of lines) {
      const fieldMatch = line.match(/^\s*-\s*\*\*(.+?)\*\*:\s*(.+)/);
      if (fieldMatch) {
        const key = fieldMatch[1].toLowerCase();
        const val = fieldMatch[2].trim();
        if (key === "role") data.role = val;
        else if (key === "ability") data.ability = val;
        else if (key === "item") data.item = val;
        else if (key === "moves") data.moves = val;
        else if (key === "nature") data.nature = val;
        else if (key === "points" || key === "evs") data.points = val;
        else extraLines.push(line);
      } else if (line.trim()) {
        extraLines.push(line);
      }
    }

    // Only treat as a Pokemon card if it has at least ability or moves
    if (data.ability || data.moves) {
      blocks.push({ type: "pokemon", data });
      // Any extra text after the card fields (not part of the card)
      const extra = extraLines.join("\n").trim();
      if (extra) {
        blocks.push({ type: "text", text: extra });
      }
    } else {
      blocks.push({ type: "text", text: part.trim() });
    }
  }

  return blocks;
}

function PokemonCard({ data }: { data: PokemonBlock }) {
  const isMega = data.name.includes("Mega") || data.name.includes("(Mega)");
  const spriteSpecies = data.name
    .replace(/\s*\(Mega\)/, "")
    .replace(/Mega\s+/, "")
    .trim();

  return (
    <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-3 flex gap-3 items-start">
      {/* Sprite */}
      <div className="shrink-0 flex flex-col items-center gap-1">
        <PokemonSprite species={spriteSpecies} size={56} />
        {isMega && (
          <Badge variant="info" className="text-[9px] px-1 py-0">
            MEGA
          </Badge>
        )}
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1 space-y-1">
        {/* Name + Role */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm text-foreground">{data.name}</span>
          {data.role && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {data.role}
            </Badge>
          )}
        </div>

        {/* Ability + Item + Nature */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {data.ability && (
            <span>
              <span className="text-foreground/70">Ability:</span> {data.ability}
            </span>
          )}
          {data.item && (
            <span>
              <span className="text-foreground/70">Item:</span> {data.item}
            </span>
          )}
          {data.nature && (
            <span>
              <span className="text-foreground/70">Nature:</span> {data.nature}
            </span>
          )}
        </div>

        {/* Moves */}
        {data.moves && (
          <div className="flex flex-wrap gap-1 mt-1">
            {data.moves.split(/\s*\/\s*/).map((move) => (
              <Badge
                key={move}
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-normal"
              >
                {move.trim()}
              </Badge>
            ))}
          </div>
        )}

        {/* Points/EVs */}
        {data.points && (
          <div className="text-[10px] text-muted-foreground mt-1 font-mono">
            {data.points}
          </div>
        )}
      </div>
    </div>
  );
}

const proseClasses =
  "prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:mt-3 prose-headings:mb-1 prose-h3:text-sm prose-h3:font-bold prose-h3:text-primary prose-h4:text-sm prose-h4:font-semibold prose-strong:text-foreground prose-strong:font-semibold prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded";

export function PokemonCardRenderer({ content }: { content: string }) {
  if (!content) return null;

  const blocks = parseContent(content);

  // If no Pokemon blocks detected, render as plain markdown
  if (!blocks.some((b) => b.type === "pokemon")) {
    return (
      <div className={proseClasses}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        if (block.type === "pokemon") {
          return <PokemonCard key={i} data={block.data} />;
        }
        return (
          <div key={i} className={proseClasses}>
            <ReactMarkdown>{block.text}</ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
}
