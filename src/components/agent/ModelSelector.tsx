"use client";

import { PROVIDERS, findProvider, type ProviderId } from "@/lib/ai/models";
import { useModelPreference } from "@/stores/use-model-preference";

/**
 * Compact dropdown for picking LLM provider + model.
 *
 * Used in every chat surface. Writes to the shared useModelPreference
 * store (localStorage-persisted), so a user who picks Claude Opus in
 * one chat gets Claude Opus in the next one too.
 *
 * We render one <select> with option groups per provider for compactness
 * — keeps the header line-height stable across surfaces.
 */
export function ModelSelector() {
  const provider = useModelPreference((s) => s.provider);
  const modelId = useModelPreference((s) => s.modelId);
  const setSelection = useModelPreference((s) => s.setSelection);

  // Compose a flat "provider::modelId" key for a single select.
  const value = `${provider}::${modelId}`;

  return (
    <select
      value={value}
      onChange={(e) => {
        const [p, ...rest] = e.target.value.split("::");
        const nextProvider = p as ProviderId;
        const nextModel = rest.join("::");
        // Guard: only accept known combos.
        if (!findProvider(nextProvider)) return;
        setSelection(nextProvider, nextModel);
      }}
      className="h-7 rounded-md border border-border bg-card px-2 text-xs text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/50"
      title="Choose which LLM provider + model powers this chat"
    >
      {PROVIDERS.map((p) => (
        <optgroup key={p.id} label={p.label}>
          {p.models.map((m) => (
            <option key={`${p.id}::${m.id}`} value={`${p.id}::${m.id}`}>
              {m.label}
              {m.tier ? ` (${m.tier})` : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
