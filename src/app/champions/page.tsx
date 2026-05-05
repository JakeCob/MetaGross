import { ChampionsRoster } from "@/components/champions/ChampionsRoster";

export const metadata = {
  title: "Champions Roster — MetaGross",
  description:
    "Complete Pokemon Champions Regulation M-A roster: every Pokemon, Mega Evolution, and confirmed item.",
};

export default function ChampionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <ChampionsRoster />
    </div>
  );
}
