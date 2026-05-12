// Cross-tab profile update broadcaster.
// Other open tabs listen and refetch their feed/profile data instantly.
const CHANNEL = "uipair-profile-updates";

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

export function onProfileUpdate(handler: (e: ProfileUpdateEvent) => void): () => void {
  const ch = getChannel();
  const bcHandler = (ev: MessageEvent) => {
    if (ev.data?.type === "profile-updated") handler(ev.data as ProfileUpdateEvent);
  };
  ch?.addEventListener("message", bcHandler);

  const storageHandler = (ev: StorageEvent) => {
    if (ev.key !== CHANNEL || !ev.newValue) return;
    try {
      const parsed = JSON.parse(ev.newValue) as { userId: string; at: number };
      handler({ type: "profile-updated", ...parsed });
    } catch { /* ignore */ }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", storageHandler);

  return () => {
    ch?.removeEventListener("message", bcHandler);
    ch?.close();
    if (typeof window !== "undefined") window.removeEventListener("storage", storageHandler);
  };
}
