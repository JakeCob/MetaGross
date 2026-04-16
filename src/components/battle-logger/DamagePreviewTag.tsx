"use client";

import type { DamagePreview } from "@/lib/engine/damage-preview";

const SEVERITY_STYLES: Record<DamagePreview["severity"], string> = {
  safe: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  moderate: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  danger: "text-rose-400 bg-rose-400/10 border-rose-400/30",
  ohko: "text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/30",
};

export function DamagePreviewTag({
  preview,
  className,
}: {
  preview: DamagePreview;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono font-medium ${SEVERITY_STYLES[preview.severity]} ${className ?? ""}`}
      title={preview.description}
    >
      {preview.label}
    </span>
  );
}
