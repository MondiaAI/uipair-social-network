import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  storageKey: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/**
 * Inline "Other" custom subject input with localStorage auto-save.
 * Shows when user has selected the "Other" option in a subject filter.
 */
export function CustomSubjectFilter({ storageKey, value, onChange, placeholder }: Props) {
  // Hydrate from localStorage on mount if empty
  useEffect(() => {
    if (value) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) onChange(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save on change (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (value) localStorage.setItem(storageKey, value);
        else localStorage.removeItem(storageKey);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [value, storageKey]);

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "Type your subject…"}
      className="text-sm"
    />
  );
}

/** Hook variant: manages state + autosave for a custom subject string. */
export function useCustomSubject(storageKey: string) {
  const [value, setValue] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(storageKey) ?? "";
    } catch {
      return "";
    }
  });
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (value) localStorage.setItem(storageKey, value);
        else localStorage.removeItem(storageKey);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [value, storageKey]);
  return [value, setValue] as const;
}
