"use client";

import { useState, useEffect, useCallback } from "react";
import { TeamCard, type TeamCardTeam } from "./TeamCard";

export function TeamList() {
  const [teams, setTeams] = useState<TeamCardTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teams");
      if (!res.ok) throw new Error("Failed to fetch teams");
      const data = await res.json();
      setTeams(data.teams ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load teams",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = window.confirm(
        "Are you sure you want to delete this team?",
      );
      if (!confirmed) return;

      try {
        const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
        if (!res.ok && res.status !== 204) {
          throw new Error("Failed to delete team");
        }
        fetchTeams();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to delete team",
        );
      }
    },
    [fetchTeams],
  );

  const handleSetActive = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/teams/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
        if (!res.ok) throw new Error("Failed to set team active");
        fetchTeams();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update team",
        );
      }
    },
    [fetchTeams],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-muted-foreground">Loading teams...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          onClick={fetchTeams}
          className="mt-2 text-sm text-primary hover:underline cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-4">&#9881;</div>
        <h2 className="text-xl font-semibold">No teams yet</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Create your first team to start tracking performance, running EV
          calculations, and getting AI-powered suggestions.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((team) => (
        <TeamCard
          key={team.id}
          team={team}
          onDelete={handleDelete}
          onSetActive={handleSetActive}
        />
      ))}
    </div>
  );
}
