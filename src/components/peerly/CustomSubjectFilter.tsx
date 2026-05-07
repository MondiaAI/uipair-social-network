import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

const SHARED_KEY = "peerly.filters.customSubject";
const EVT = "peerly:custom-subject-changed";

function readShared(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(SHARED_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeShared(v: string) {
  try {
    if (v) localStorage.setItem(SHARED_KEY, v);
    else localStorage.removeItem(SHARED_KEY);
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVT, { detail: v }));
  }
}

/**
 * Shared "Other" custom subject term — synced across all subject filters
 * (posts, circles, bounties, gigs, match) via a single localStorage key
 * and a window event so updates propagate instantly between mounted views.
 *
 * The `_storageKey` argument is accepted for backwards compatibility with
 * existing callers but ignored — every consumer reads/writes the same value.
 */
export function useCustomSubject(_storageKey?: string) {
  const [value, setValue] = useState<string>(() => readShared());

  useEffect(() => {
    const onCustom = (e: Event) => {
      const v = (e as CustomEvent<string>).detail ?? "";
      setValue((prev) => (prev === v ? prev : v));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SHARED_KEY) return;
      setValue(e.newValue ?? "");
    };
    window.addEventListener(EVT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = (v: string) => {
    setValue(v);
    writeShared(v);
  };

  return [value, update] as const;
}

interface Props {
  storageKey?: string; // ignored, kept for API compatibility
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function CustomSubjectFilter({ value, onChange, placeholder }: Props) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "Type your subject (synced everywhere)…"}
      className="text-sm"
    />
  );
}
