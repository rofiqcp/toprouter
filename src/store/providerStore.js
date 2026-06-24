"use client";

import { create } from "zustand";
import { CLIENT_STORE_TTL_MS } from "@/shared/constants/config";

let inflightFetch = null;

const useProviderStore = create((set, get) => ({
  providers: [],
  loading: false,
  error: null,
  lastFetched: 0,

  setProviders: (providers) => set({ providers, lastFetched: Date.now() }),

  addProvider: (provider) =>
    set((state) => ({ providers: [provider, ...state.providers] })),

  updateProvider: (id, updates) =>
    set((state) => ({
      providers: state.providers.map((p) =>
        p._id === id ? { ...p, ...updates } : p
      ),
    })),

  removeProvider: (id) =>
    set((state) => ({
      providers: state.providers.filter((p) => p._id !== id),
    })),

  invalidate: () => set({ lastFetched: 0 }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  // Skips network when cache is fresh (< CLIENT_STORE_TTL_MS). Pass {force:true} to override.
  // Deduplicates concurrent fetch calls.
  fetchProviders: async ({ force = false } = {}) => {
    const { lastFetched, providers } = get();
    if (!force && providers.length > 0 && Date.now() - lastFetched < CLIENT_STORE_TTL_MS) return;
    // Deduplicate concurrent requests
    if (!force && inflightFetch) return inflightFetch;
    const doFetch = async () => {
      set({ loading: true, error: null });
      try {
        const response = await fetch("/api/providers");
        const data = await response.json();
        if (response.ok) {
          set({ providers: data.connections || data.providers || [], loading: false, lastFetched: Date.now() });
        } else {
          set({ error: data.error, loading: false });
        }
      } catch (error) {
        set({ error: "Failed to fetch providers", loading: false });
      } finally {
        inflightFetch = null;
      }
    };
    inflightFetch = doFetch();
    return inflightFetch;
  },
}));

export default useProviderStore;

