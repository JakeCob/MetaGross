"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PokemonSprite } from "@/components/pokemon-sprite";
import { getMegaFormFor } from "@/lib/data/champions";

export interface TeamCardTeam {
  id: string;
  name: string;
  format: string | null;
  isActive: number | null;
  pokemon: { species: string; item?: string | null }[];
}

export interface TeamCardProps {
  team: TeamCardTeam;
  onDelete: (id: string) => void;
  onSetActive: (id: string) => void;
}

export function TeamCard({ team, onDelete, onSetActive }: TeamCardProps) {
  const isActive = team.isActive === 1;

  return (
    <Card
      className={`transition-colors ${isActive ? "border-primary/50" : ""}`}
    >
      <CardContent>
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                {team.name}
              </h3>
              {isActive && (
                <Badge variant="success" className="text-[10px]">
                  Active
                </Badge>
              )}
            </div>
            {team.format && (
              <Badge className="text-[10px]">{team.format}</Badge>
            )}
          </div>

          {/* Pokemon list */}
          <div className="flex flex-wrap gap-2">
            {team.pokemon.length > 0 ? (
              team.pokemon.map((mon, i) => {
                const megaForm = getMegaFormFor(mon.species, mon.item);
                const displaySpecies = megaForm ?? mon.species;
                const isMega = Boolean(megaForm);
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                    title={isMega ? `Mega ${mon.species}` : mon.species}
                  >
                    <PokemonSprite
                      species={displaySpecies}
                      mega={isMega}
                      size={32}
                      className="shrink-0"
                    />
                    <span>
                      {isMega && (
                        <span className="text-[9px] font-semibold text-amber-400 uppercase tracking-wider mr-1">
                          M
                        </span>
                      )}
                      {mon.species}
                    </span>
                  </span>
                );
              })
            ) : (
              <span className="text-xs text-muted-foreground">No Pokemon</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Link href={`/teams/${team.id}`}>
              <Button variant="outline" size="sm" className="text-xs h-7 px-2">
                View
              </Button>
            </Link>
            <Link href={`/teams/${team.id}/edit`}>
              <Button variant="outline" size="sm" className="text-xs h-7 px-2">
                Edit
              </Button>
            </Link>
            {!isActive && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => onSetActive(team.id)}
              >
                Set Active
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2 text-destructive hover:text-destructive"
              onClick={() => onDelete(team.id)}
            >
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
