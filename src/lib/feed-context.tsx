import { createContext, useContext, useState, ReactNode } from "react";

export type FeedMode = "campus" | "global";

interface FeedContextValue {
  mode: FeedMode;
  setMode: (m: FeedMode) => void;
}

const FeedContext = createContext<FeedContextValue | undefined>(undefined);

export function FeedProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<FeedMode>("global");
  return <FeedContext.Provider value={{ mode, setMode }}>{children}</FeedContext.Provider>;
}

export function useFeedMode() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error("useFeedMode must be used inside FeedProvider");
  return ctx;
}
