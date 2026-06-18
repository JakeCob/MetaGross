import { isAIAvailable } from "@/lib/ai/client";
import {
  getMbContentBreakdown,
  getRegulationAnalysis,
} from "@/lib/ai/regulation-analysis";
import { RegulationAnalysis } from "@/components/meta/RegulationAnalysis";

export const metadata = {
  title: "Regulation Analysis — MetaGross",
  description:
    "AI meta-impact breakdown of the new Champions regulation: new Pokemon, Mega Evolutions, items, and predicted meta teams.",
};

// Always read the latest cached analysis on load.
export const dynamic = "force-dynamic";

export default async function RegulationAnalysisPage() {
  const breakdown = getMbContentBreakdown();
  const { insights, cached } = await getRegulationAnalysis(undefined, {
    readOnly: true,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <RegulationAnalysis
        breakdown={breakdown}
        initialInsights={insights}
        initialCached={cached}
        aiAvailable={isAIAvailable()}
      />
    </div>
  );
}
