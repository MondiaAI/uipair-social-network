import { useEffect, useRef } from "react";

interface JitsiCallProps {
  roomName: string;
  displayName?: string;
  email?: string;
  onClose?: () => void;
  className?: string;
}

/**
 * Jitsi Meet room embedded via iframe. Uses meet.jit.si (free, no API key,
 * uses the participants' own internet — works for 1-on-1 chats, group calls,
 * and live LMS-style sessions where one student delivers a course.
 */
export function JitsiCall({ roomName, displayName, email, onClose, className }: JitsiCallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    const ensureScript = () =>
      new Promise<void>((resolve, reject) => {
        if ((window as any).JitsiMeetExternalAPI) return resolve();
        const existing = document.querySelector<HTMLScriptElement>(
          'script[src="https://meet.jit.si/external_api.js"]'
        );
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("Jitsi failed to load")));
          return;
        }
        const s = document.createElement("script");
        s.src = "https://meet.jit.si/external_api.js";
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Jitsi failed to load"));
        document.head.appendChild(s);
      });

    ensureScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const JitsiMeetExternalAPI = (window as any).JitsiMeetExternalAPI;
        const api = new JitsiMeetExternalAPI("meet.jit.si", {
          roomName,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: { displayName: displayName ?? "Student", email: email ?? "" },
          configOverwrite: {
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
          },
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
            SHOW_JITSI_WATERMARK: false,
            SHOW_BRAND_WATERMARK: false,
          },
        });
        apiRef.current = api;
        if (onClose) api.addEventListener("readyToClose", onClose);
      })
      .catch((e) => {
        console.error(e);
      });

    return () => {
      cancelled = true;
      try {
        apiRef.current?.dispose();
      } catch {
        /* noop */
      }
      apiRef.current = null;
    };
  }, [roomName, displayName, email, onClose]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
