"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_MODEL_ID,
  DEFAULT_PROVIDER,
  type ProviderId,
} from "@/lib/ai/models";

/**
 * Per-browser persistent choice of which LLM provider + model powers
 * every chat surface. Lives in localStorage so it survives reloads.
 *
 * Per-surface override: callers can still pass an explicit override
 * to sendMessage. The store is the default when no override is set.
 */
interface ModelPreferenceState {
  provider: ProviderId;
  modelId: string;
  setProvider: (p: ProviderId) => void;
  setModel: (id: string) => void;
  setSelection: (p: ProviderId, id: string) => void;
  reset: () => void;
}

export const useModelPreference = create<ModelPreferenceState>()(
  persist(
    (set) => ({
      provider: DEFAULT_PROVIDER,
      modelId: DEFAULT_MODEL_ID,
      setProvider: (provider) => set({ provider }),
      setModel: (modelId) => set({ modelId }),
      setSelection: (provider, modelId) => set({ provider, modelId }),
      reset: () => set({ provider: DEFAULT_PROVIDER, modelId: DEFAULT_MODEL_ID }),
    }),
    {
      name: "metagross:model-preference",
      version: 1,
    },
  ),
);
