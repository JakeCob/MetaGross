import { TeamBuilderWithAgent } from "@/components/team-builder/TeamBuilderWithAgent";

interface NewTeamPageProps {
  searchParams: Promise<{ core?: string; name?: string }>;
}

export default async function NewTeamPage({ searchParams }: NewTeamPageProps) {
  const { core, name } = await searchParams;

  const initialSpecies = core
    ? core
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:py-8">
      <TeamBuilderWithAgent
        initialSpecies={initialSpecies}
        initialName={name}
      />
    </div>
  );
}
