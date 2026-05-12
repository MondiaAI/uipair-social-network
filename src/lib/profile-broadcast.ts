// Cross-tab profile update broadcaster.
// Other open tabs listen and refetch their feed/profile data instantly.
const CHANNEL = "uipair-profile-updates";
const DEBOUNCE_MS = 1000;

export type ProfileUpdateEvent = {
  type: "profile-updated";
  userId: string;
  at: number;
};

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(CHANNEL);
}

export function broadcastProfileUpdate(userId: string) {
  try {
    const ch = getChannel();
    if (ch) {
      ch.postMessage({ type: "profile-updated", userId, at: Date.now() } satisfies ProfileUpdateEvent);
      ch.close();
    }
    // Fallback for browsers without BroadcastChannel: storage event
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHANNEL, JSON.stringify({ userId, at: Date.now() }));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Subscribe to cross-tab profile update events.
 * Handler invocations are debounced (trailing-edge) per userId so a burst of
 * rapid saves only triggers one re-fetch per second.
 */
export function onProfileUpdate(handler: (e: ProfileUpdateEvent) => void): () => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const latest = new Map<string, ProfileUpdateEvent>();

  const schedule = (e: ProfileUpdateEvent) => {
    latest.set(e.userId, e);
    if (timers.has(e.userId)) return;
    const t = setTimeout(() => {
      timers.delete(e.userId);
      const last = latest.get(e.userId);
      latest.delete(e.userId);
      if (last) handler(last);
    }, DEBOUNCE_MS);
    timers.set(e.userId, t);
  };

  const ch = getChannel();
  const bcHandler = (ev: MessageEvent) => {
    if (ev.data?.type === "profile-updated") schedule(ev.data as ProfileUpdateEvent);
  };
  ch?.addEventListener("message", bcHandler);

  const storageHandler = (ev: StorageEvent) => {
    if (ev.key !== CHANNEL || !ev.newValue) return;
    try {
      const parsed = JSON.parse(ev.newValue) as { userId: string; at: number };
      schedule({ type: "profile-updated", ...parsed });
    } catch { /* ignore */ }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", storageHandler);

  return () => {
    ch?.removeEventListener("message", bcHandler);
    ch?.close();
    if (typeof window !== "undefined") window.removeEventListener("storage", storageHandler);
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
    latest.clear();
  };
}
