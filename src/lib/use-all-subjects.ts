import { useEffect, useState } from "react";
import { getAllSubjects, CUSTOM_SUBJECTS_EVT } from "./subjects";

const STORAGE_KEY = "peerly.subjects.custom";

/** Reactive list of all subjects (built-in + user-added), synced across tabs. */
export function useAllSubjects(): string[] {
  const [list, setList] = useState<string[]>(() => getAllSubjects());
  useEffect(() => {
    const refresh = () => setList(getAllSubjects());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refresh();
    };
    window.addEventListener(CUSTOM_SUBJECTS_EVT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CUSTOM_SUBJECTS_EVT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return list;
}
