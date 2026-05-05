import type { Metadata } from "next";
import { TeamArchive } from "@/components/team-archive/TeamArchive";

export const metadata: Metadata = {
  title: "Team Archive | MetaGross",
  description:
    "Browse tournament-winning teams, meta archetype templates, and curated builds from top VGC creators.",
};

export default function TeamArchivePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <TeamArchive />
    </div>
  );
}
