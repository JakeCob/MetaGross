"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TeamPokemon } from "@/lib/types/pokemon";

interface TeamPreviewProps {
  myTeam: TeamPokemon[];
  opponentTeam: Partial<TeamPokemon>[];
  onComplete: (data: {
    myBrought: string[];
    opponentBrought: string[];
    myLeads: string[];
    opponentLeads: string[];
  }) => void;
}

type PreviewPhase = "bring" | "leads";

export function TeamPreview({
  myTeam,
  opponentTeam,
  onComplete,
}: TeamPreviewProps) {
  const [phase, setPhase] = useState<PreviewPhase>("bring");

  // Brought-4 selections
  const [myBrought, setMyBrought] = useState<string[]>([]);
  const [oppBrought, setOppBrought] = useState<string[]>([]);

  // Lead-2 selections
  const [myLeads, setMyLeads] = useState<string[]>([]);
  const [oppLeads, setOppLeads] = useState<string[]>([]);

  const toggleBring = useCallback(
    (species: string, side: "my" | "opp") => {
      if (phase !== "bring") return;
      const [list, setList] =
        side === "my"
          ? [myBrought, setMyBrought]
          : [oppBrought, setOppBrought];

      if (list.includes(species)) {
        setList(list.filter((s) => s !== species));
      } else if (list.length < 4) {
        setList([...list, species]);
      }
    },
    [phase, myBrought, oppBrought],
  );

  const toggleLead = useCallback(
    (species: string, side: "my" | "opp") => {
      if (phase !== "leads") return;
      const [list, setList] =
        side === "my" ? [myLeads, setMyLeads] : [oppLeads, setOppLeads];

      if (list.includes(species)) {
        setList(list.filter((s) => s !== species));
      } else if (list.length < 2) {
        setList([...list, species]);
      }
    },
    [phase, myLeads, oppLeads],
  );

  const bringReady = myBrought.length === 4 && oppBrought.length === 4;
  const leadsReady = myLeads.length === 2 && oppLeads.length === 2;

  const handleProceedToLeads = useCallback(() => {
    if (bringReady) {
      setPhase("leads");
    }
  }, [bringReady]);

  const handleStartBattle = useCallback(() => {
    if (leadsReady) {
      onComplete({
        myBrought,
        opponentBrought: oppBrought,
        myLeads,
        opponentLeads: oppLeads,
      });
    }
  }, [leadsReady, myBrought, oppBrought, myLeads, oppLeads, onComplete]);

  // Pokemon card for either side
  const renderPokemonCard = (
    species: string,
    side: "my" | "opp",
    extra?: { item?: string; ability?: string },
  ) => {
    const broughtList = side === "my" ? myBrought : oppBrought;
    const leadList = side === "my" ? myLeads : oppLeads;
    const isBrought = broughtList.includes(species);
    const isLead = leadList.includes(species);

    if (phase === "bring") {
      return (
        <button
          key={species}
          type="button"
          onClick={() => toggleBring(species, side)}
          className={`cursor-pointer relative flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all ${
            isBrought
              ? "border-primary bg-accent/10 ring-1 ring-accent/30"
              : "border-border bg-card hover:border-muted"
          } ${!isBrought && broughtList.length >= 4 ? "opacity-40" : ""}`}
        >
          <span className="text-sm font-medium text-foreground">
            {species}
          </span>
          {extra?.item && (
            <span className="text-[10px] text-muted-foreground">{extra.item}</span>
          )}
          {isBrought && (
            <Badge variant="info" className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0">
              {broughtList.indexOf(species) + 1}
            </Badge>
          )}
        </button>
      );
    }

    // Leads phase — only show brought Pokemon
    if (!isBrought) {
      return (
        <div
          key={species}
          className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-3 text-center opacity-30"
        >
          <span className="text-sm font-medium text-foreground">
            {species}
          </span>
          <span className="text-[10px] text-muted-foreground">Not brought</span>
        </div>
      );
    }

    return (
      <button
        key={species}
        type="button"
        onClick={() => toggleLead(species, side)}
        className={`cursor-pointer relative flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all ${
          isLead
            ? "border-success bg-success/10 ring-1 ring-success/30"
            : "border-primary bg-accent/10 hover:border-primary"
        }`}
      >
        <span className="text-sm font-medium text-foreground">{species}</span>
        {extra?.item && (
          <span className="text-[10px] text-muted-foreground">{extra.item}</span>
        )}
        {isLead && (
          <Badge variant="success" className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0">
            Lead
          </Badge>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {phase === "bring" ? "Select Brought 4" : "Select Leads"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {phase === "bring"
            ? "Click to select the 4 Pokemon each side brought to battle."
            : "Select the 2 lead Pokemon for each side."}
        </p>
      </div>

      {/* My Team */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            My Team
          </h3>
          <span className="text-xs text-muted-foreground">
            {phase === "bring"
              ? `${myBrought.length}/4 selected`
              : `${myLeads.length}/2 leads`}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {myTeam.map((mon) =>
            renderPokemonCard(mon.species, "my", {
              item: mon.item,
            }),
          )}
        </div>
      </div>

      {/* Opponent Team */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Opponent Team
          </h3>
          <span className="text-xs text-muted-foreground">
            {phase === "bring"
              ? `${oppBrought.length}/4 selected`
              : `${oppLeads.length}/2 leads`}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {opponentTeam.map((mon) =>
            renderPokemonCard(mon.species!, "opp", {
              item: mon.item,
            }),
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-2">
        {phase === "bring" && (
          <>
            <span className="text-sm text-muted-foreground">
              {bringReady ? "Ready to pick leads" : "Select 4 on each side"}
            </span>
            <Button onClick={handleProceedToLeads} disabled={!bringReady}>
              Pick Leads
            </Button>
          </>
        )}
        {phase === "leads" && (
          <>
            <Button
              variant="outline"
              onClick={() => {
                setPhase("bring");
                setMyLeads([]);
                setOppLeads([]);
              }}
            >
              Back
            </Button>
            <Button onClick={handleStartBattle} disabled={!leadsReady}>
              Start Battle
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
