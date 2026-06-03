import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Cache = { universities: string[]; countries: string[]; loadedAt: number };
let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;
const TTL_MS = 5 * 60 * 1000;

async function loadSuggestions(): Promise<Cache> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("profiles")
      .select("university, country")
      .not("university", "is", null)
      .limit(1000);
    const uSet = new Set<string>();
    const cSet = new Set<string>();
    for (const row of data ?? []) {
      const u = (row.university ?? "").trim();
      const c = (row.country ?? "").trim();
      if (u) uSet.add(u);
      if (c) cSet.add(c);
    }
    cache = {
      universities: [...uSet].sort((a, b) => a.localeCompare(b)),
      countries: [...cSet].sort((a, b) => a.localeCompare(b)),
      loadedAt: Date.now(),
    };
    inflight = null;
    return cache;
  })();
  return inflight;
}

export function useLocationSuggestions() {
  const [data, setData] = useState<Cache | null>(cache);
  useEffect(() => {
    let alive = true;
    loadSuggestions().then((c) => { if (alive) setData(c); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return {
    universities: data?.universities ?? [],
    countries: data?.countries ?? [],
  };
}
