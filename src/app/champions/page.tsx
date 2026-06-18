import { ChampionsRoster } from "@/components/champions/ChampionsRoster";
import { ACTIVE_REGULATION_LABEL } from "@/lib/data/champions";

export const metadata = {
  title: "Champions Roster — MetaGross",
  description: `Complete ${ACTIVE_REGULATION_LABEL} roster: every Pokemon, Mega Evolution, and confirmed item.`,
};

export default function ChampionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <ChampionsRoster />
    </div>
  );
}
