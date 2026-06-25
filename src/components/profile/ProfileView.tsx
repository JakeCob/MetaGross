import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PokemonSprite } from "@/components/pokemon-sprite";
import type { PlayerProfile } from "@/lib/profile/build-profile";

const ARCHETYPE_ICON: Record<string, string> = {
  Rain: "🌧️",
  Sun: "☀️",
  Sand: "🏜️",
  Snow: "❄️",
  "Trick Room": "🔮",
  Tailwind: "💨",
  Balance: "⚖️",
};

function wrColor(wr: number, total: number): string {
  if (total === 0) return "text-muted-foreground";
  if (wr >= 55) return "text-emerald-400";
  if (wr < 45) return "text-rose-400";
  return "text-amber-400";
}

export function ProfileView({ profile }: { profile: PlayerProfile }) {
  const { record, streak } = profile;
  return (
    <div className="flex flex-col gap-4">
      {/* Record header */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Record
            </div>
            <div className="text-2xl font-bold">
              {record.wins}<span className="text-muted-foreground">–</span>{record.losses}
              <span className={`ml-2 text-base ${wrColor(record.winRate, record.total)}`}>
                {record.total > 0 ? `${record.winRate}%` : "—"}
              </span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Streak
            </div>
            <div className="text-lg font-semibold">
              {streak ? (
                <span className={streak.type === "win" ? "text-emerald-400" : "text-rose-400"}>
                  {streak.count} {streak.type === "win" ? "W" : "L"}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Logged
            </div>
            <div className="text-lg font-semibold">
              {profile.matchCount} matches · {profile.teamCount} teams
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferred archetypes */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">Preferred archetypes</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.preferredArchetypes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Save a few teams to see the archetypes you favor (rain, snow, Trick
              Room…). Classified automatically from team composition.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profile.preferredArchetypes.map((a) => (
                <Badge key={a.archetype} variant="secondary" className="gap-1 text-xs">
                  <span>{ARCHETYPE_ICON[a.archetype] ?? "•"}</span>
                  {a.archetype}
                  <span className="text-muted-foreground">
                    · {a.teams} team{a.teams !== 1 ? "s" : ""}
                    {a.matches > 0 ? `, ${a.matches} played` : ""}
                  </span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Strengths / weaknesses by archetype */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">
            Strengths &amp; weaknesses{" "}
            <span className="text-[10px] font-normal text-muted-foreground">
              (your win-rate by archetype)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profile.archetypeStrengths.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Log matches with your saved teams to unlock win-rate by archetype —
              which of your styles actually win.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {profile.archetypeStrengths.map((a) => (
                <div key={a.archetype} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0">
                    {ARCHETYPE_ICON[a.archetype] ?? "•"} {a.archetype}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${a.winRate >= 50 ? "bg-emerald-500" : "bg-rose-500"}`}
                      style={{ width: `${a.wins + a.losses > 0 ? a.winRate : 0}%` }}
                    />
                  </div>
                  <span className={`w-28 shrink-0 text-right ${wrColor(a.winRate, a.wins + a.losses)}`}>
                    {a.wins}–{a.losses}
                    {a.wins + a.losses > 0 ? ` (${a.winRate}%)` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Win-rate vs opponent archetypes — your weak matchups */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">
            Matchups vs opponents{" "}
            <span className="text-[10px] font-normal text-muted-foreground">
              (your win-rate vs each archetype they bring)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profile.opponentArchetypes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Log matches and the opponent&apos;s archetype is auto-detected from
              what they bring — revealing which styles give you trouble.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {[...profile.opponentArchetypes]
                .sort((a, b) => a.winRate - b.winRate)
                .map((a) => {
                  const total = a.wins + a.losses;
                  return (
                    <div key={a.archetype} className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0">
                        {ARCHETYPE_ICON[a.archetype] ?? "•"} {a.archetype}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${a.winRate >= 50 ? "bg-emerald-500" : "bg-rose-500"}`}
                          style={{ width: `${total > 0 ? a.winRate : 0}%` }}
                        />
                      </div>
                      <span className={`w-28 shrink-0 text-right ${wrColor(a.winRate, total)}`}>
                        {a.wins}–{a.losses}
                        {total > 0 ? ` (${a.winRate}%)` : ""}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Most-used Pokémon */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">Most-used Pokémon</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.mostUsedPokemon.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No brought-Pokémon data yet — log matches to see your go-to picks.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profile.mostUsedPokemon.map((p) => (
                <div
                  key={p.species}
                  className="flex items-center gap-1.5 rounded-md border border-border/50 bg-background/50 px-2 py-1"
                >
                  <PokemonSprite species={p.species} size={28} />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium">{p.species}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {p.timesBrought}× · {p.winRateWhenBrought}% W
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Most-faced Pokémon — opponents' go-to picks + your win-rate vs them */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">
            Most-faced Pokémon{" "}
            <span className="text-[10px] font-normal text-muted-foreground">
              (opponents&apos; picks · your win-rate when faced)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profile.mostFacedPokemon.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No opponent-Pokémon data yet — log matches (with what they brought)
              to see the threats you face most.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profile.mostFacedPokemon.map((p) => (
                <div
                  key={p.species}
                  className="flex items-center gap-1.5 rounded-md border border-border/50 bg-background/50 px-2 py-1"
                >
                  <PokemonSprite species={p.species} size={28} />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium">{p.species}</span>
                    <span className={`text-[9px] ${wrColor(p.winRateWhenBrought, p.timesBrought)}`}>
                      {p.timesBrought}× · {p.winRateWhenBrought}% W
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
