"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { PokemonSprite } from "@/components/pokemon-sprite";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface PokemonBlock {
  name: string;
  role?: string;
  ability?: string;
  item?: string;
  moves?: string;
  nature?: string;
  points?: string;
}

export interface CardActions {
  onAddToTeam?: (data: PokemonBlock) => void;
  onAddAllToTeam?: (data: PokemonBlock[]) => void;
  onCopy?: (data: PokemonBlock) => void;
  onResuggest?: (species: string) => void;
  onChangeField?: (species: string, field: string, prompt: string) => void;
}

/**
 * Parse agent markdown into Pokemon card blocks + regular text blocks.
 */
function parseContent(content: string): Array<{ type: "text"; text: string } | { type: "pokemon"; data: PokemonBlock }> {
  const blocks: Array<{ type: "text"; text: string } | { type: "pokemon"; data: PokemonBlock }> = [];

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

    // Skip section headings that aren't Pokemon names
    const nonPokemonHeadings = [
      "additional", "team summary", "team members", "summary",
      "key synergies", "lead combinations", "matchup", "notes",
      "overview", "strategy", "tips", "principles",
    ];
    if (nonPokemonHeadings.some((h) => name.toLowerCase().includes(h))) {
      blocks.push({ type: "text", text: part.trim() });
      continue;
    }

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

    if (data.ability || data.moves) {
      blocks.push({ type: "pokemon", data });
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

function formatPokepaste(data: PokemonBlock): string {
  const lines: string[] = [];
  const itemPart = data.item ? ` @ ${data.item}` : "";
  lines.push(`${data.name}${itemPart}`);
  if (data.ability) lines.push(`Ability: ${data.ability}`);
  if (data.nature) lines.push(`${data.nature} Nature`);
  if (data.points) lines.push(`EVs: ${data.points}`);
  if (data.moves) {
    for (const move of data.moves.split(/\s*\/\s*/)) {
      lines.push(`- ${move.trim()}`);
    }
  }
  return lines.join("\n");
}

function PokemonCard({ data, actions }: { data: PokemonBlock; actions?: CardActions }) {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);

  const isMega = data.name.includes("Mega") || data.name.includes("(Mega)")
    || Boolean(data.item && data.item.toLowerCase().endsWith("ite"))
    || Boolean(data.item && data.item.toLowerCase() === "dragoninite");
  const spriteSpecies = data.name
    .replace(/\s*\(Mega\)/, "")
    .replace(/Mega\s+/, "")
    .trim();

  const handleCopy = () => {
    const paste = formatPokepaste(data);
    navigator.clipboard.writeText(paste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    actions?.onCopy?.(data);
  };

  return (
    <div
      className={`rounded-xl border bg-card/80 backdrop-blur-sm p-3 ${isMega ? "border-purple-500/30" : "border-border"} hover:border-primary/30 transition-colors`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex gap-3 items-start">
        {/* Sprite */}
        <div className="shrink-0 flex flex-col items-center gap-1">
          <PokemonSprite species={spriteSpecies} mega={isMega} size={56} />
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

      {/* Action buttons — visible on hover or always on mobile */}
      {actions && (showActions || true) && (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/50">
          {actions.onAddToTeam && (
            <Button
              size="xs"
              variant="default"
              onClick={() => actions.onAddToTeam!(data)}
            >
              + Add to Team
            </Button>
          )}
          <Button
            size="xs"
            variant="outline"
            onClick={handleCopy}
          >
            {copied ? "Copied!" : "Copy"}
          </Button>
          {actions.onResuggest && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => actions.onResuggest!(data.name)}
            >
              Resuggest
            </Button>
          )}
          {actions.onChangeField && (
            <>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => actions.onChangeField!(data.name, "moves", `Suggest different moves for ${data.name}`)}
              >
                Change Moves
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => actions.onChangeField!(data.name, "spread", `Suggest a better EV spread for ${data.name} with specific benchmarks`)}
              >
                Change Spread
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const proseClasses =
  "prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:mt-3 prose-headings:mb-1 prose-h3:text-sm prose-h3:font-bold prose-h3:text-primary prose-h4:text-sm prose-h4:font-semibold prose-strong:text-foreground prose-strong:font-semibold prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded";

export function PokemonCardRenderer({
  content,
  actions,
}: {
  content: string;
  actions?: CardActions;
}) {
  if (!content) return null;

  const blocks = parseContent(content);
  const pokemonBlocks = blocks.filter((b): b is { type: "pokemon"; data: PokemonBlock } => b.type === "pokemon");

  // If no Pokemon blocks detected, render as plain markdown
  if (pokemonBlocks.length === 0) {
    return (
      <div className={proseClasses}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Add All button if multiple Pokemon */}
      {actions?.onAddAllToTeam && pokemonBlocks.length > 1 && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => actions.onAddAllToTeam!(pokemonBlocks.map((b) => b.data))}
          >
            + Add All {pokemonBlocks.length} to Team
          </Button>
        </div>
      )}

      {blocks.map((block, i) => {
        if (block.type === "pokemon") {
          return <PokemonCard key={i} data={block.data} actions={actions} />;
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
