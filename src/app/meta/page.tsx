import { MetaOverview } from "@/components/meta/MetaOverview";

export const metadata = {
  title: "Meta Overview — MetaGross",
  description:
    "Live Pikalytics usage statistics for Pokemon Champions VGC formats",
};

export default function MetaPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <MetaOverview />
    </div>
  );
}
