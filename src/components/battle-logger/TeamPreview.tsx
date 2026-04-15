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

// The USER picks their own brought-4 (known), then leads-2 (known).
// The OPPONENT has 6 Pokemon in team preview, but on Switch you only see
// their 2 leads at match start — which 4 they brought is unknown until
// their back two Pokemon actually switch in during the match. So we only
// ask for opponent leads; opponentBrought is seeded with those 2 and
// grows later as the opponent reveals their back.
type PreviewPhase = "mine-bring" | "mine-leads" | "opp-leads";

export function TeamPreview({
  myTeam,
  opponentTeam,
  onComplete,
}: TeamPreviewProps) {
  const [phase, setPhase] = useState<PreviewPhase>("mine-bring");

  const [myBrought, setMyBrought] = useState<string[]>([]);
  const [myLeads, setMyLeads] = useState<string[]>([]);
  const [oppLeads, setOppLeads] = useState<string[]>([]);

  const toggleMyBrought = useCallback(
    (species: string) => {
      if (phase !== "mine-bring") return;
      setMyBrought((prev) => {
        if (prev.includes(species)) return prev.filter((s) => s !== species);
        if (prev.length < 4) return [...prev, species];
        return prev;
      });
    },
    [phase],
  );

  const toggleMyLead = useCallback(
    (species: string) => {
      if (phase !== "mine-leads") return;
      setMyLeads((prev) => {
        if (prev.includes(species)) return prev.filter((s) => s !== species);
        if (prev.length < 2) return [...prev, species];
        return prev;
      });
    },
    [phase],
  );

  const toggleOppLead = useCallback(
    (species: string) => {
      if (phase !== "opp-leads") return;
      setOppLeads((prev) => {
        if (prev.includes(species)) return prev.filter((s) => s !== species);
        if (prev.length < 2) return [...prev, species];
        return prev;
      });
    },
    [phase],
  );

  const myBroughtReady = myBrought.length === 4;
  const myLeadsReady = myLeads.length === 2;
  const oppLeadsReady = oppLeads.length === 2;

  const phaseTitle =
    phase === "mine-bring"
      ? "Pick Your Brought 4"
      : phase === "mine-leads"
        ? "Pick Your Leads"
        : "Pick Opponent's Leads";

  const phaseDescription =
    phase === "mine-bring"
      ? "Select the 4 Pokemon you brought to this match."
      : phase === "mine-leads"
        ? "Select which 2 of your brought Pokemon are leading."
        : "Select the 2 Pokemon your opponent leads with. You'll add their back two later when they switch in.";

  // Render a selectable card for MY side (bring / leads phase aware).
  const renderMyCard = (species: string, item?: string) => {
    const isBrought = myBrought.includes(species);
    const isLead = myLeads.includes(species);

    if (phase === "mine-bring") {
      const disabled = !isBrought && myBrought.length >= 4;
      return (
        <button
          key={species}
          type="button"
          onClick={() => toggleMyBrought(species)}
          className={`cursor-pointer relative flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all ${
            isBrought
              ? "border-primary bg-accent/10 ring-1 ring-accent/30"
              : "border-border bg-card hover:border-muted"
          } ${disabled ? "opacity-40" : ""}`}
        >
          <span className="text-sm font-medium text-foreground">{species}</span>
          {item && <span className="text-[10px] text-muted-foreground">{item}</span>}
          {isBrought && (
            <Badge variant="info" className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0">
              {myBrought.indexOf(species) + 1}
            </Badge>
          )}
        </button>
      );
    }

    // mine-leads: only brought Pokemon are clickable; rest are dimmed.
    if (!isBrought) {
      return (
        <div
          key={species}
          className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-3 text-center opacity-30"
        >
          <span className="text-sm font-medium text-foreground">{species}</span>
          <span className="text-[10px] text-muted-foreground">Not brought</span>
        </div>
      );
    }
    return (
      <button
        key={species}
        type="button"
        onClick={() => toggleMyLead(species)}
        className={`cursor-pointer relative flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all ${
          isLead
            ? "border-success bg-success/10 ring-1 ring-success/30"
            : "border-primary bg-accent/10 hover:border-primary"
        }`}
      >
        <span className="text-sm font-medium text-foreground">{species}</span>
        {item && <span className="text-[10px] text-muted-foreground">{item}</span>}
        {isLead && (
          <Badge variant="success" className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0">
            Lead
          </Badge>
        )}
      </button>
    );
  };

  // Render an opponent card (only the leads phase uses it interactively).
  const renderOppCard = (species: string, item?: string) => {
    const isLead = oppLeads.includes(species);
    const disabled = !isLead && oppLeads.length >= 2;
    return (
      <button
        key={species}
        type="button"
        onClick={() => toggleOppLead(species)}
        disabled={phase !== "opp-leads"}
        className={`relative flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all ${
          isLead
            ? "border-success bg-success/10 ring-1 ring-success/30 cursor-pointer"
            : phase === "opp-leads"
              ? `border-border bg-card hover:border-muted cursor-pointer ${disabled ? "opacity-40" : ""}`
              : "border-border bg-card opacity-50 cursor-not-allowed"
        }`}
      >
        <span className="text-sm font-medium text-foreground">{species}</span>
        {item && <span className="text-[10px] text-muted-foreground">{item}</span>}
        {isLead && (
          <Badge variant="success" className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0">
            Lead
          </Badge>
        )}
      </button>
    );
  };

  const handleNext = useCallback(() => {
    if (phase === "mine-bring" && myBroughtReady) setPhase("mine-leads");
    else if (phase === "mine-leads" && myLeadsReady) setPhase("opp-leads");
    else if (phase === "opp-leads" && oppLeadsReady) {
      onComplete({
        myBrought,
        // Seed opponentBrought with the 2 known leads. Switch-ins during
        // the match will append the rest as they are revealed.
        opponentBrought: [...oppLeads],
        myLeads,
        opponentLeads: oppLeads,
      });
    }
  }, [phase, myBroughtReady, myLeadsReady, oppLeadsReady, myBrought, myLeads, oppLeads, onComplete]);

  const handleBack = useCallback(() => {
    if (phase === "mine-leads") {
      setPhase("mine-bring");
      setMyLeads([]);
    } else if (phase === "opp-leads") {
      setPhase("mine-leads");
      setOppLeads([]);
    }
  }, [phase]);

  const canProceed =
    (phase === "mine-bring" && myBroughtReady) ||
    (phase === "mine-leads" && myLeadsReady) ||
    (phase === "opp-leads" && oppLeadsReady);

  const nextLabel =
    phase === "opp-leads" ? "Start Battle" : "Next";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">{phaseTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{phaseDescription}</p>
        {/* Step indicator */}
        <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-wider">
          {(["mine-bring", "mine-leads", "opp-leads"] as PreviewPhase[]).map(
            (p, i, arr) => (
              <div key={p} className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 border ${
                    phase === p
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {i + 1}.{" "}
                  {p === "mine-bring"
                    ? "My 4"
                    : p === "mine-leads"
                      ? "My Leads"
                      : "Opp Leads"}
                </span>
                {i < arr.length - 1 && (
                  <span className="text-muted-foreground">→</span>
                )}
              </div>
            ),
          )}
        </div>
      </div>

      {/* My Team — only interactive during the first two phases */}
      {(phase === "mine-bring" || phase === "mine-leads") && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              My Team
            </h3>
            <span className="text-xs text-muted-foreground">
              {phase === "mine-bring"
                ? `${myBrought.length}/4 brought`
                : `${myLeads.length}/2 leads`}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {myTeam.map((mon) => renderMyCard(mon.species, mon.item))}
          </div>
        </div>
      )}

      {/* Opponent Team — only rendered during the opp-leads phase */}
      {phase === "opp-leads" && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Opponent Team (all 6 from team preview)
            </h3>
            <span className="text-xs text-muted-foreground">
              {oppLeads.length}/2 leads
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {opponentTeam.map((mon) => renderOppCard(mon.species!, mon.item))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            You&apos;ll record the opponent&apos;s back 2 as they switch in during the match.
          </p>
        </div>
      )}

      {/* Summary of my picks once moved past mine-bring */}
      {phase !== "mine-bring" && (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Your picks:</span>{" "}
          Brought {myBrought.join(", ")}
          {myLeads.length > 0 && (
            <>
              {" · "}Leads {myLeads.join(", ")}
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-2">
        {phase === "mine-bring" ? (
          <span className="text-sm text-muted-foreground">
            {myBroughtReady ? "Ready" : `Select ${4 - myBrought.length} more`}
          </span>
        ) : (
          <Button variant="outline" onClick={handleBack}>
            Back
          </Button>
        )}
        <Button onClick={handleNext} disabled={!canProceed}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
