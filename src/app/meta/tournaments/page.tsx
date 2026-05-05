import { TournamentList } from "@/components/meta/TournamentList";

export const metadata = {
  title: "Tournaments — MetaGross",
  description:
    "Recent VGC Champions tournament results with full team lists from Limitless VGC",
};

export default function TournamentsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <TournamentList />
    </div>
  );
}
