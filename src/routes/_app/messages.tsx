import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare, Paperclip, Smile, X, FileText, Image as ImageIcon, Bell, BellOff, CheckCheck, ShieldCheck, ShieldAlert, ShieldQuestion, Pencil, Trash2, ArrowLeft, MessageSquarePlus, Eye, EyeOff, Download, Video } from "lucide-react";
import { NewChatDialog } from "@/components/peerly/NewChatDialog";
import { VideoCallDialog } from "@/components/peerly/VideoCallDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const EMOJIS = ["😀","😂","😍","🥲","🙌","👍","🎉","🔥","💯","🤔","😎","🙏","❤️","👀","✅","🚀","📚","☕","🌙","✨"];
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ensureDeviceKeypair,
  fetchPublicKey,
  encryptMessage,
  decryptMessage,
  isEncrypted,
  fallbackLabel,
  type KeyPair,
  type DecryptResult,
} from "@/lib/e2ee";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { logClientError } from "@/lib/client-logger";
import { submitCrashReport } from "@/lib/crash-report";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";
import { uploadPrivateFileForSignedUrl } from "@/lib/storage";

const search = z.object({ c: z.string().uuid().optional(), m: z.string().optional() });

// Module-level snapshot of relevant page state, updated by MessagesPage via
// useEffect. Read by the ErrorBoundary at crash time so the console log
// includes the exact React props/state in play (active chat, search params,
// message ids, encryption status).
const pageSnapshot: { current: Record<string, unknown> } = { current: {} };

function MessagesPageBoundary() {
  return (
    <ErrorBoundary label="MessagesPage" getContext={() => pageSnapshot.current}>
      <MessagesPage />
    </ErrorBoundary>
  );
}

export const Route = createFileRoute("/_app/messages")({
  validateSearch: (s) => search.parse(s),
  component: MessagesPageBoundary,
  errorComponent: ({ error, reset }) => {
    logClientError("MessagesRoute.errorComponent", error, pageSnapshot.current);
    return <MessagesRouteError error={error} reset={reset} />;
  },
});

function MessagesRouteError({ error, reset }: { error: Error; reset: () => void }) {
  const [state, setState] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [reportId, setReportId] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const onSubmit = async () => {
    setState("submitting");
    setSubmitErr(null);
    try {
      const id = await submitCrashReport({
        label: "MessagesRoute.errorComponent",
        errorName: error.name,
        message: error.message,
        stack: error.stack ?? null,
        context: pageSnapshot.current,
      });
      setReportId(id);
      setState("submitted");
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };
  return (
    <div className="m-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p className="font-semibold text-destructive">Failed to load messages.</p>
      <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-[11px]">{error.message}</pre>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={reset} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
          Try again
        </button>
        <button
          onClick={onSubmit}
          disabled={state === "submitting" || state === "submitted"}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
        >
          {state === "submitting" ? "Submitting…" : state === "submitted" ? "Submitted ✓" : state === "error" ? "Retry submit" : "Submit diagnostics"}
        </button>
        {state === "submitted" && reportId && (
          <span className="text-[11px] text-muted-foreground">Report ID: {reportId.slice(0, 8)}</span>
        )}
        {state === "error" && submitErr && (
          <span className="text-[11px] text-destructive">{submitErr}</span>
        )}
      </div>
    </div>
  );
}

interface ConversationRow {
  id: string;
  user_a: string;
  user_b: string;
  last_message_at: string;
  other?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  preview?: string;
  unread?: number;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string | null;
  deleted_for_sender?: boolean;
  deleted_for_recipient?: boolean;
}

function MessagesPage() {
  const { user } = useAuth();
  const { c: activeId, m: prefill } = Route.useSearch();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [oneTime, setOneTime] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  // DB-backed per-recipient one-time view tracking.
  // Key = `${message_id}:${line_index}`. Value = viewer_id (who viewed it).
  // RLS ensures:
  //  - Recipient only sees their own view records.
  //  - Sender sees view records on messages they sent (so they know it was opened).
  const [ottViews, setOttViews] = useState<Record<string, string>>({});
  const markOttViewedLocal = (key: string, viewerId: string) => {
    setOttViews((prev) => (prev[key] ? prev : { ...prev, [key]: viewerId }));
  };
  const unmarkOttViewedLocal = (key: string) => {
    setOttViews((prev) => {
      if (!prev[key]) return prev;
      const { [key]: _drop, ...rest } = prev;
      return rest;
    });
  };
  // In-flight guard so a double-tap doesn't double-insert.
  const ottInFlight = useRef<Set<string>>(new Set());
  // Returns true if the view was durably recorded (or already existed).
  // Optimistically marks local state, then writes to DB with retries+backoff.
  // Rolls back local state and toasts if every attempt fails.
  const recordOttView = async (messageId: string, lineIndex: number): Promise<boolean> => {
    if (!user) return false;
    const key = `${messageId}:${lineIndex}`;
    if (ottInFlight.current.has(key)) return false;
    if (ottViews[key]) return true;
    ottInFlight.current.add(key);
    markOttViewedLocal(key, user.id);
    const delays = [0, 400, 1200]; // total ~1.6s across 3 attempts
    let lastErr: unknown = null;
    try {
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt]) await new Promise((r) => setTimeout(r, delays[attempt]));
        const { error } = await supabase
          .from("message_attachment_views")
          .insert({ message_id: messageId, line_index: lineIndex, viewer_id: user.id });
        if (!error) return true;
        // Duplicate = already recorded (race with realtime), treat as success.
        if (/duplicate|unique/i.test(error.message)) return true;
        lastErr = error;
        console.warn(`[ott] insert attempt ${attempt + 1} failed`, error);
      }
      unmarkOttViewedLocal(key);
      toast.error("Couldn't mark as viewed", {
        description: "Network issue — tap to try again.",
        action: { label: "Retry", onClick: () => void recordOttView(messageId, lineIndex) },
      });
      logClientError("ott.recordView", lastErr, { messageId, lineIndex });
      return false;
    } finally {
      ottInFlight.current.delete(key);
    }
  };
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [search, setSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [chatSearchOpen, setChatSearchOpen] = useState(false);

  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [videoCallOpen, setVideoCallOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [keypair, setKeypair] = useState<KeyPair | null>(null);
  const [counterpartPub, setCounterpartPub] = useState<Uint8Array | null>(null);
  // Map of otherUserId -> whether they have published a public key
  const [peerKeyStatus, setPeerKeyStatus] = useState<Record<string, boolean>>({});

  type EncStatus = "ready" | "pending" | "failed";
  const encStatusFor = (c: ConversationRow): EncStatus => {
    if (!keypair) return "failed";
    const otherId = c.user_a === user?.id ? c.user_b : c.user_a;
    return peerKeyStatus[otherId] ? "ready" : "pending";
  };

  const StatusBadge = ({ status, compact = false }: { status: EncStatus; compact?: boolean }) => {
    const map = {
      ready: { Icon: ShieldCheck, label: "Encrypted", desc: "Messages are end-to-end encrypted.", cls: "text-emerald-600" },
      pending: { Icon: ShieldQuestion, label: "Pending", desc: "Recipient hasn't set up encryption yet.", cls: "text-amber-600" },
      failed: { Icon: ShieldAlert, label: "Unavailable", desc: "Encryption keys aren't ready on this device.", cls: "text-destructive" },
    } as const;
    const { Icon, label, desc, cls } = map[status];
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("inline-flex items-center gap-1 shrink-0", cls)} aria-label={`Encryption: ${label}`}>
              <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
              {!compact && <span className="text-xs font-medium">{label}</span>}
            </span>
          </TooltipTrigger>
          <TooltipContent>{desc}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Bootstrap this device's E2EE keypair and publish public key to profile.
  useEffect(() => {
    if (!user) return;
    ensureDeviceKeypair(user.id).then((kp) => kp && setKeypair(kp));
  }, [user]);

  // Helper: decrypt a stored content string using current keypair + counterpart.
  const decryptContent = (content: string): DecryptResult => {
    if (!isEncrypted(content)) return { ok: false, reason: "legacy" };
    return decryptMessage(content, keypair, counterpartPub);
  };

  // Plain-text preview for sidebar — collapsed to a single line, capped length.
  const previewText = (content: string | undefined): string => {
    if (!content) return "Say hi 👋";
    const raw = !isEncrypted(content)
      ? content
      : (() => {
          const r = decryptMessage(content, keypair, null);
          return r.ok ? r.plaintext : "";
        })();
    const oneLine = raw.replace(/\s+/g, " ").trim();
    if (!oneLine) return "Say hi 👋";
    return oneLine.length > 60 ? oneLine.slice(0, 60).trimEnd() + "…" : oneLine;
  };

  // Render text with matches against `q` highlighted.
  const renderHighlighted = (text: string, q: string) => {
    if (!q) return text;
    const lower = text.toLowerCase();
    const ql = q.toLowerCase();
    const parts: Array<{ t: string; hit: boolean }> = [];
    let i = 0;
    while (i < text.length) {
      const idx = lower.indexOf(ql, i);
      if (idx === -1) { parts.push({ t: text.slice(i), hit: false }); break; }
      if (idx > i) parts.push({ t: text.slice(i, idx), hit: false });
      parts.push({ t: text.slice(idx, idx + ql.length), hit: true });
      i = idx + ql.length;
    }
    return parts.map((p, k) =>
      p.hit ? (
        <mark key={k} className="rounded-sm bg-yellow-300/70 px-0.5 text-foreground dark:bg-yellow-500/40">{p.t}</mark>
      ) : (
        <span key={k}>{p.t}</span>
      ),
    );
  };

  const persistMuted = async (id: string, next: boolean) => {
    setMuted((prev) => ({ ...prev, [id]: next }));
    if (!user) return;
    if (next) {
      const { error } = await supabase
        .from("conversation_mutes")
        .upsert({ user_id: user.id, conversation_id: id }, { onConflict: "user_id,conversation_id" });
      if (error) {
        setMuted((prev) => ({ ...prev, [id]: !next }));
        toast.error(error.message);
      }
    } else {
      const { error } = await supabase
        .from("conversation_mutes")
        .delete()
        .eq("user_id", user.id)
        .eq("conversation_id", id);
      if (error) {
        setMuted((prev) => ({ ...prev, [id]: !next }));
        toast.error(error.message);
      }
    }
  };
  const toggleMute = (id: string) => persistMuted(id, !muted[id]);
  const activeIdRef = useRef<string | undefined>(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const MAX_LEN = 2000;
  const OTT_PREFIX = "ott1:";
  const isOneTimeLine = (s: string) => s.trim().startsWith(OTT_PREFIX);
  const stripOtt = (s: string) => s.trim().slice(OTT_PREFIX.length);
  const urlPath = (s: string): string => {
    try { return new URL(s).pathname; } catch { return s; }
  };
  const isImageUrl = (s: string) => {
    const t = isOneTimeLine(s) ? stripOtt(s) : s.trim();
    if (!/^https?:\/\//i.test(t)) return false;
    return /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(urlPath(t)) || /\.(png|jpe?g|gif|webp|avif)$/i.test(urlPath(t));
  };
  const filenameFromUrl = (s: string) => {
    try {
      const last = decodeURIComponent(new URL(s).pathname.split("/").pop() || "file");
      // strip our "<timestamp>-<rand>." prefix from safeStorageName
      const cleaned = last.replace(/^\d+-[a-z0-9]+\./i, "");
      return cleaned || last;
    } catch { return "file"; }
  };

  // Apply prefill from query string once per active conversation
  useEffect(() => {
    if (prefill) {
      setDraft(prefill);
      navigate({ to: "/messages", search: (prev: { c?: string; m?: string }) => ({ ...prev, m: undefined }), replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, activeId]);

  // Load conversation list + subscribe
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, user_a, user_b, last_message_at")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("last_message_at", { ascending: false });
      const list = (convs ?? []) as ConversationRow[];
      const otherIds = list.map((c) => (c.user_a === user.id ? c.user_b : c.user_a));
      if (otherIds.length === 0) {
        setConversations([]);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", otherIds);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));

      // Fetch latest message preview + unread counts per conversation
      const { data: previews } = await supabase
        .from("messages")
        .select("conversation_id, content, created_at, sender_id, read_at")
        .in("conversation_id", list.map((c) => c.id))
        .order("created_at", { ascending: false });
      const previewBy = new Map<string, string>();
      const unreadBy = new Map<string, number>();
      (previews ?? []).forEach((m) => {
        if (!previewBy.has(m.conversation_id)) previewBy.set(m.conversation_id, m.content);
        if (m.sender_id !== user.id && !m.read_at) {
          unreadBy.set(m.conversation_id, (unreadBy.get(m.conversation_id) ?? 0) + 1);
        }
      });

      setConversations(
        list.map((c) => {
          const otherId = c.user_a === user.id ? c.user_b : c.user_a;
          return {
            ...c,
            other: byId.get(otherId) as ConversationRow["other"],
            preview: previewBy.get(c.id),
            unread: unreadBy.get(c.id) ?? 0,
          };
        })
      );
    };
    load();

    const channel = supabase
      .channel(uniqueRealtimeChannelName(`conv_list:${user.id}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => load())
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as MessageRow;
          // Optimistically bump unread + preview without a full reload
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === m.conversation_id);
            if (idx === -1) { load(); return prev; }
            const next = [...prev];
            const isMine = m.sender_id === user.id;
            const isActive = activeIdRef.current === m.conversation_id;
            const inc = isMine || isActive ? 0 : 1;
            next[idx] = {
              ...next[idx],
              preview: m.content,
              last_message_at: m.created_at,
              unread: (next[idx].unread ?? 0) + inc,
            };
            // Re-sort by last_message_at desc
            next.sort((a, b) => (a.last_message_at < b.last_message_at ? 1 : -1));
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Load muted conversations from Supabase + subscribe to changes
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("conversation_mutes")
        .select("conversation_id")
        .eq("user_id", user.id);
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((r: { conversation_id: string }) => { map[r.conversation_id] = true; });
      setMuted(map);
    };
    load();
    const channel = supabase
      .channel(uniqueRealtimeChannelName(`mutes:${user.id}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_mutes", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Load active conversation messages + subscribe
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setChatSearch("");
      setChatSearchOpen(false);
      return;
    }
    setChatSearch("");
    setChatSearchOpen(false);

    setConversations((prev) => prev.map((c) => c.id === activeId ? { ...c, unread: 0 } : c));
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, created_at, read_at, deleted_for_sender, deleted_for_recipient")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      setMessages((data ?? []) as MessageRow[]);
      // Mark incoming unread messages as read
      if (user) {
        await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .eq("conversation_id", activeId)
          .neq("sender_id", user.id)
          .is("read_at", null);
        setConversations((prev) => prev.map((c) => c.id === activeId ? { ...c, unread: 0 } : c));
      }
    };
    load();

    const channel = supabase
      .channel(uniqueRealtimeChannelName(`messages:${activeId}`))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as MessageRow).id)
              ? prev
              : [...prev, payload.new as MessageRow]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const m = payload.new as MessageRow;
          setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, content: m.content, read_at: m.read_at, deleted_for_sender: m.deleted_for_sender, deleted_for_recipient: m.deleted_for_recipient } : x));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const oldId = (payload.old as { id: string }).id;
          setMessages((prev) => prev.filter((x) => x.id !== oldId));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId]);

  // Load + subscribe to one-time-view records for the current conversation.
  // RLS narrows rows to: my own views, plus views on messages I sent.
  useEffect(() => {
    if (!user || !activeId || messages.length === 0) return;
    const ids = messages.map((m) => m.id);
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("message_attachment_views")
        .select("message_id, line_index, viewer_id")
        .in("message_id", ids);
      if (cancelled || !data) return;
      setOttViews((prev) => {
        const next = { ...prev };
        for (const r of data as Array<{ message_id: string; line_index: number; viewer_id: string }>) {
          next[`${r.message_id}:${r.line_index}`] = r.viewer_id;
        }
        return next;
      });
    })();
    const channel = supabase
      .channel(uniqueRealtimeChannelName(`ott-views:${activeId}`))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_attachment_views" },
        (payload) => {
          const r = payload.new as { message_id: string; line_index: number; viewer_id: string };
          if (!ids.includes(r.message_id)) return;
          setOttViews((prev) => ({ ...prev, [`${r.message_id}:${r.line_index}`]: r.viewer_id }));
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, activeId, messages]);

  // Fetch counterpart's E2EE public key when active conversation changes
  useEffect(() => {
    if (!user || !activeId) { setCounterpartPub(null); return; }
    const conv = conversations.find((c) => c.id === activeId);
    const otherId = conv ? (conv.user_a === user.id ? conv.user_b : conv.user_a) : null;
    if (!otherId) { setCounterpartPub(null); return; }
    let cancelled = false;
    fetchPublicKey(otherId).then((pk) => {
      if (cancelled) return;
      setCounterpartPub(pk);
      setPeerKeyStatus((prev) => ({ ...prev, [otherId]: !!pk }));
    });
    return () => { cancelled = true; };
  }, [activeId, user, conversations]);

  // Backfill: re-encrypt any of MY own plaintext messages in this conversation
  // so all stored messages end up E2EE. We can only safely rewrite messages we
  // sent ourselves (RLS allows updating own rows via delete+insert pattern is
  // not needed — we just update content in place via delete+reinsert? messages
  // table has no UPDATE policy for sender, only "Recipients mark messages
  // read". Instead delete the plaintext row and insert an encrypted one.)
  useEffect(() => {
    if (!user || !activeId || !keypair || !counterpartPub) return;
    const plaintextMine = messages.filter(
      (m) => m.sender_id === user.id && !isEncrypted(m.content)
    );
    if (plaintextMine.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const m of plaintextMine) {
        if (cancelled) return;
        try {
          const cipher = encryptMessage(m.content, counterpartPub, keypair);
          // Delete + re-insert so RLS (sender can delete + insert) lets us
          // upgrade legacy plaintext rows to encrypted ones.
          const { error: delErr } = await supabase.from("messages").delete().eq("id", m.id);
          if (delErr) continue;
          await supabase.from("messages").insert({
            conversation_id: m.conversation_id,
            sender_id: user.id,
            content: cipher,
          });
        } catch {
          /* skip */
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeId, user, keypair, counterpartPub, messages]);


  // Bulk-fetch peer key presence for the conversation list (for sidebar badges)
  useEffect(() => {
    if (!user || conversations.length === 0) return;
    const otherIds = Array.from(new Set(
      conversations.map((c) => (c.user_a === user.id ? c.user_b : c.user_a))
    )).filter((id) => !(id in peerKeyStatus));
    if (otherIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, public_key")
        .in("id", otherIds);
      if (cancelled) return;
      const update: Record<string, boolean> = {};
      otherIds.forEach((id) => { update[id] = false; });
      (data ?? []).forEach((r: { id: string; public_key: string | null }) => {
        update[r.id] = !!r.public_key;
      });
      setPeerKeyStatus((prev) => ({ ...prev, ...update }));
    })();
    return () => { cancelled = true; };
  }, [conversations, user]);


  // Keep the module-level snapshot in sync so the ErrorBoundary can log
  // exactly what props/state were in play when a render error happens.
  useEffect(() => {
    pageSnapshot.current = {
      userId: user?.id ?? null,
      activeConversationId: activeId ?? null,
      prefillSearchParam: prefill ?? null,
      conversationCount: conversations.length,
      messageCount: messages.length,
      messageIds: messages.slice(-20).map((m) => m.id),
      lastMessageId: messages[messages.length - 1]?.id ?? null,
      // Per-message decryption diagnostics for the most recent 20 messages.
      // Captures whether each row is encrypted and whether it decrypts on
      // this device — invaluable for reproducing crashes tied to a specific
      // message that fails to render.
      messageDecryption: messages.slice(-20).map((m) => {
        const encrypted = isEncrypted(m.content);
        if (!encrypted) {
          return { id: m.id, senderId: m.sender_id, encrypted: false, decrypted: false, reason: "legacy" as const };
        }
        const r = decryptMessage(m.content, keypair, counterpartPub);
        return r.ok
          ? { id: m.id, senderId: m.sender_id, encrypted: true, decrypted: true, plaintextLength: r.plaintext.length }
          : { id: m.id, senderId: m.sender_id, encrypted: true, decrypted: false, reason: r.reason };
      }),
      decryptFailureCount: messages.reduce((n, m) => {
        if (!isEncrypted(m.content)) return n;
        return decryptMessage(m.content, keypair, counterpartPub).ok ? n : n + 1;
      }, 0),
      hasKeypair: !!keypair,
      hasCounterpartPub: !!counterpartPub,
      peerKeyStatus,
      mutedConversationIds: Object.keys(muted).filter((k) => muted[k]),
      draftLength: draft.length,
      hasAttachment: !!attachment,
      sending,
      uploading,
      searchQuery: search,
      // Scroll/viewport diagnostics — captured at snapshot time so a crash
      // log lets us reproduce the exact rendered window of messages.
      scroll: (() => {
        const el = scrollerRef.current;
        if (!el) return null;
        const { scrollTop, clientHeight, scrollHeight } = el;
        // Estimate visible message index range by walking child nodes and
        // checking which ones intersect the viewport.
        const children = Array.from(el.children) as HTMLElement[];
        let firstVisible = -1;
        let lastVisible = -1;
        for (let i = 0; i < children.length; i++) {
          const c = children[i];
          const top = c.offsetTop - el.offsetTop;
          const bottom = top + c.offsetHeight;
          if (bottom >= scrollTop && top <= scrollTop + clientHeight) {
            if (firstVisible === -1) firstVisible = i;
            lastVisible = i;
          }
        }
        return {
          scrollTop,
          clientHeight,
          scrollHeight,
          atBottom: scrollTop + clientHeight >= scrollHeight - 4,
          firstVisibleChildIndex: firstVisible,
          lastVisibleChildIndex: lastVisible,
          renderedChildCount: children.length,
        };
      })(),
    };
  }, [user, activeId, prefill, conversations, messages, keypair, counterpartPub, peerKeyStatus, muted, draft, attachment, sending, uploading, search]);

  // Auto-scroll
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages, activeId]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  const deleteForMe = async (m: MessageRow) => {
    if (!user) return;
    const mine = m.sender_id === user.id;
    const patch = mine ? { deleted_for_sender: true } : { deleted_for_recipient: true };
    const { error } = await supabase.from("messages").update(patch).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, ...patch } : x));
    toast.success("Message removed from your view");
  };

  const deleteForEveryone = async (id: string) => {
    if (!confirm("Delete this message for everyone?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMessages((prev) => prev.filter((m) => m.id !== id));
    toast.success("Message deleted for everyone");
  };

  const saveEdit = async (m: MessageRow) => {
    const next = editDraft.trim();
    if (!next) return;
    let payload = next;
    if (keypair && counterpartPub) {
      try { payload = encryptMessage(next, counterpartPub, keypair); } catch { /* fallback to plaintext */ }
    }
    const { error } = await supabase.from("messages").update({ content: payload }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, content: payload } : x));
    setEditingId(null);
    setEditDraft("");
  };

  const send = async () => {
    if (!user || !activeId) return;
    if (!draft.trim() && !attachment) return;
    setSending(true);
    const originalDraft = draft;
    const originalAttachment = attachment;
    let content = draft.trim();
    const file = attachment;
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    try {
      if (file) {
        setUploading(true);
        setUploadProgress(5);
        // Simulated progress while supabase-js uploads (no native progress event).
        progressTimer = setInterval(() => {
          setUploadProgress((p) => (p < 90 ? p + Math.max(1, (90 - p) * 0.15) : p));
        }, 200);
        const { url, error } = await uploadPrivateFileForSignedUrl("resources", user.id, file);
        if (error || !url) throw new Error(error || "Could not share file");
        const isImg = file.type.startsWith("image/");
        const fileLine = oneTime ? `${OTT_PREFIX}${url}` : url;
        content = content ? `${content}\n${fileLine}` : fileLine;
        void isImg;
        setUploadProgress(100);
      }
      // Encrypt when both keys are available; otherwise send plaintext so
      // delivery is never blocked.
      let payload: string = content;
      let recipientPub = counterpartPub;
      if (!recipientPub) {
        const conv = conversations.find((c) => c.id === activeId);
        const otherId = conv ? (conv.user_a === user.id ? conv.user_b : conv.user_a) : null;
        recipientPub = otherId ? await fetchPublicKey(otherId) : null;
        if (recipientPub) setCounterpartPub(recipientPub);
      }
      if (keypair && recipientPub) {
        payload = encryptMessage(content, recipientPub, keypair);
      }
      const { error } = await supabase
        .from("messages")
        .insert({ conversation_id: activeId, sender_id: user.id, content: payload });
      if (error) throw error;
      // Only clear draft + attachment after a fully successful send
      setDraft("");
      setAttachment(null);
      setOneTime(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send");
      // Restore exactly what the user had
      setDraft(originalDraft);
      setAttachment(originalAttachment);
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setUploading(false);
      setUploadProgress(0);
      setSending(false);
    }
  };

  const onPickFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }
    setAttachment(f);
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const next = (val: string) => val.slice(0, MAX_LEN);
    if (!el) {
      setDraft((d) => next(d + emoji));
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const updated = next(draft.slice(0, start) + emoji + draft.slice(end));
    setDraft(updated);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] md:h-[calc(100vh-8rem)] w-full max-w-5xl flex-col md:flex-row gap-0 md:gap-4 px-0 md:px-4 py-0 md:py-6 overflow-hidden">
      {/* Sidebar — full-width list on mobile when no chat is selected */}
      <aside className={cn(
        "min-w-0 max-w-full flex-col rounded-none md:rounded-xl border-x-0 md:border bg-card shadow-sm w-full md:w-72 flex-1 md:flex-none overflow-hidden",
        active ? "hidden md:flex" : "flex",
      )}>

        <div className="border-b p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold">Messages</h1>
            <div className="flex items-center gap-1.5">
              {(() => {
                const total = conversations.reduce((s, c) => s + (muted[c.id] ? 0 : (c.unread ?? 0)), 0);
                return total > 0 ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    {total} new
                  </span>
                ) : null;
              })()}
              <Button
                type="button"
                size="sm"
                onClick={() => setNewChatOpen(true)}
                className="h-8 gap-1.5 px-2.5"
              >
                <MessageSquarePlus className="h-4 w-4" />
                <span className="hidden sm:inline">New</span>
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="h-9 flex-1"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0"
              title="Mark all as read"
              disabled={!user || conversations.every((c) => (c.unread ?? 0) === 0)}
              onClick={async () => {
                if (!user) return;
                const ids = conversations.filter((c) => (c.unread ?? 0) > 0).map((c) => c.id);
                if (ids.length === 0) return;
                const { error } = await supabase
                  .from("messages")
                  .update({ read_at: new Date().toISOString() })
                  .in("conversation_id", ids)
                  .neq("sender_id", user.id)
                  .is("read_at", null);
                if (error) { toast.error(error.message); return; }
                setConversations((prev) => prev.map((c) => ({ ...c, unread: 0 })));
                toast.success("All conversations marked as read");
              }}
            >
              <CheckCheck className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {(() => {
            const q = search.trim().toLowerCase();
            const filtered = q
              ? conversations.filter((c) => {
                  const name = (c.other?.full_name || c.other?.username || "").toLowerCase();
                  const preview = (c.preview ?? "").toLowerCase();
                  return name.includes(q) || preview.includes(q);
                })
              : conversations;
            if (conversations.length === 0) {
              return (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  <p>No conversations yet.</p>
                  <Button size="sm" className="mt-3 gap-1.5" onClick={() => setNewChatOpen(true)}>
                    <MessageSquarePlus className="h-4 w-4" /> Start a new chat
                  </Button>
                </div>
              );
            }
            if (filtered.length === 0) {
              return <div className="p-6 text-center text-sm text-muted-foreground">No matches</div>;
            }
            return filtered.map((c) => {
              const name = c.other?.full_name || c.other?.username || "Student";
              const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
              const isActive = c.id === activeId;
              const unread = c.unread ?? 0;
              const ago = c.last_message_at
                ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })
                    .replace("about ", "")
                    .replace(" minutes", "m")
                    .replace(" minute", "m")
                    .replace(" hours", "h")
                    .replace(" hour", "h")
                    .replace(" days", "d")
                    .replace(" day", "d")
                    .replace("less than am", "now")
                : "";
              return (
                <button
                  key={c.id}
                  onClick={() => navigate({ to: "/messages", search: { c: c.id } })}
                  className={cn(
                    "flex w-full max-w-full items-center gap-2 border-b px-3 py-2 text-left transition-colors active:bg-accent/70 hover:bg-accent min-h-[60px] touch-manipulation overflow-hidden",
                    isActive && "bg-accent",
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={c.other?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex items-baseline justify-between gap-2 min-w-0">
                      <p className={cn("truncate text-[13px] flex items-center gap-1 min-w-0 flex-1 leading-tight", unread > 0 && !muted[c.id] ? "font-semibold" : "font-medium")}>
                        {muted[c.id] && <BellOff className="h-3 w-3 text-muted-foreground shrink-0" />}
                        <span className="truncate">{name}</span>
                      </p>
                      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{ago}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 min-w-0">
                      <p className={cn("truncate text-xs leading-tight flex-1 min-w-0", unread > 0 && !muted[c.id] ? "text-foreground" : "text-muted-foreground")}>
                        {previewText(c.preview)}
                      </p>
                      {unread > 0 && (
                        <span className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                          muted[c.id] ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
                        )}>
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            });
          })()}
        </div>
      </aside>


      {/* Chat panel — full-width on mobile when a chat is open */}
      <section className={cn(
        "flex-1 flex-col rounded-none md:rounded-xl border-x-0 md:border bg-card shadow-sm",
        active ? "flex" : "hidden md:flex",
      )}>
        {!active ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a conversation to start chatting
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2 sm:gap-3 border-b p-3 sm:p-4">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="md:hidden h-9 w-9 shrink-0 -ml-1"
                onClick={() => navigate({ to: "/messages", search: {} })}
                aria-label="Back to conversations"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={active.other?.avatar_url ?? undefined} />
                <AvatarFallback>
                  {(active.other?.full_name || active.other?.username || "S").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {active.other?.full_name || active.other?.username || "Student"}
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">
                  {muted[active.id] ? "Notifications muted" : "Private chat"}
                </p>
              </div>
              
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setVideoCallOpen(true)}
                title="Start video call"
                aria-label="Start video call"
              >
                <Video className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setChatSearchOpen((v) => !v)}
                title={chatSearchOpen ? "Close search" : "Search messages"}
                aria-label={chatSearchOpen ? "Close search" : "Search messages"}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  toggleMute(active.id);
                  toast.message(muted[active.id] ? "Notifications unmuted" : "Notifications muted");
                }}
                title={muted[active.id] ? "Unmute notifications" : "Mute notifications"}
                aria-label={muted[active.id] ? "Unmute notifications" : "Mute notifications"}
              >
                {muted[active.id] ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              </Button>
            </header>

            {chatSearchOpen && (
              <div className="border-b bg-muted/30 px-3 py-2 flex items-center gap-2">
                <Input
                  autoFocus
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Search this conversation…"
                  className="h-8 flex-1 text-sm"
                />
                {chatSearch && (
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                    {(() => {
                      const q = chatSearch.trim().toLowerCase();
                      const n = messages.reduce((acc, m) => {
                        const enc = isEncrypted(m.content);
                        const plain = enc ? decryptContent(m.content) : { ok: true as const, plaintext: m.content };
                        return plain.ok && plain.plaintext.toLowerCase().includes(q) ? acc + 1 : acc;
                      }, 0);
                      return `${n} match${n === 1 ? "" : "es"}`;
                    })()}
                  </span>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => { setChatSearchOpen(false); setChatSearch(""); }}
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}


            <div ref={scrollerRef} className="flex-1 space-y-1.5 sm:space-y-3 overflow-y-auto p-3 sm:p-4">
              {(() => {
                // Filter out messages the current user has deleted from their own view
                const ownFiltered = messages.filter((m) => {
                  if (!user) return true;
                  if (m.sender_id === user.id) return !m.deleted_for_sender;
                  return !m.deleted_for_recipient;
                });
                if (ownFiltered.length === 0) {
                  return (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No messages yet. Send the first one!
                    </p>
                  );
                }
                const q = chatSearchOpen ? chatSearch.trim().toLowerCase() : "";
                const visible = q
                  ? ownFiltered.filter((m) => {
                      const enc = isEncrypted(m.content);
                      const plain = enc ? decryptContent(m.content) : { ok: true as const, plaintext: m.content };
                      return plain.ok && plain.plaintext.toLowerCase().includes(q);
                    })
                  : ownFiltered;
                if (q && visible.length === 0) {
                  return (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No messages match "{chatSearch}"
                    </p>
                  );
                }
                const formatDateDivider = (d: Date) => {
                  const today = new Date();
                  const yesterday = new Date();
                  yesterday.setDate(today.getDate() - 1);
                  const sameDay = (a: Date, b: Date) =>
                    a.getFullYear() === b.getFullYear() &&
                    a.getMonth() === b.getMonth() &&
                    a.getDate() === b.getDate();
                  if (sameDay(d, today)) return "Today";
                  if (sameDay(d, yesterday)) return "Yesterday";
                  const sameYear = d.getFullYear() === today.getFullYear();
                  return d.toLocaleDateString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    ...(sameYear ? {} : { year: "numeric" }),
                  });
                };
                let lastDayKey = "";
                return (
                  <>
                    {visible.map((m) => {
                      const mine = m.sender_id === user?.id;
                      const encrypted = isEncrypted(m.content);
                      const decrypted = encrypted
                        ? decryptContent(m.content)
                        : { ok: true as const, plaintext: m.content };
                      const displayText = decrypted.ok ? decrypted.plaintext : m.content;
                      const showFallback = !decrypted.ok;
                      const isEditing = editingId === m.id;
                      // Hide messages that cannot be decrypted on this device
                      if (showFallback) return null;
                      const dt = new Date(m.created_at);
                      const dayKey = dt.toDateString();
                      const showDivider = dayKey !== lastDayKey;
                      if (showDivider) lastDayKey = dayKey;
                      return (
                        <div key={`wrap-${m.id}`}>
                        {showDivider && (
                          <div className="flex items-center justify-center my-3" aria-label={`Messages from ${formatDateDivider(dt)}`}>
                            <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                              {formatDateDivider(dt)}
                            </span>
                          </div>
                        )}
                        <div key={m.id} className={cn("group flex items-end gap-1", mine ? "justify-end" : "justify-start")}>
                          {mine && !isEditing && (
                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setEditingId(m.id); setEditDraft(decrypted.ok ? decrypted.plaintext : ""); }}
                                disabled={!decrypted.ok}
                                title="Edit"
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    title="Delete"
                                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onClick={() => deleteForMe(m)}>Delete for me</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => deleteForEveryone(m.id)} className="text-destructive focus:text-destructive">
                                    Delete for everyone
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                          {!mine && (
                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => deleteForMe(m)}
                                title="Delete for me"
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          <div
                            className={cn(
                              "max-w-[80%] sm:max-w-[75%] rounded-2xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-[13px] sm:text-sm shadow-sm",
                              mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                            )}
                          >
                            {isEditing ? (
                              <div className="space-y-2 min-w-[220px]">
                                <Textarea
                                  value={editDraft}
                                  onChange={(e) => setEditDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (editDraft.trim()) saveEdit(m); }
                                    if (e.key === "Escape") { e.preventDefault(); setEditingId(null); setEditDraft(""); }
                                  }}
                                  autoFocus
                                  className="min-h-[60px] text-sm bg-background text-foreground"
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditDraft(""); }}>
                                    Cancel
                                  </Button>
                                  <Button size="sm" onClick={() => saveEdit(m)} disabled={!editDraft.trim()}>
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : showFallback ? null : (
                              <div className="flex flex-wrap items-end gap-x-2 gap-y-0.5">
                                <div className="min-w-0 flex-1">
                                  {displayText.split("\n").map((rawLine, i) => {
                                    const ott = isOneTimeLine(rawLine);
                                    const line = ott ? stripOtt(rawLine) : rawLine;
                                    const img = isImageUrl(line);
                                    const link = /^https?:\/\//i.test(line);
                                    const key = `${m.id}:${i}`;
                                    const viewedBy = ott ? ottViews[key] : undefined;
                                    if (ott) {
                                      // Sender's own view: always visible + shows viewed status.
                                      if (mine) {
                                        const wasViewed = !!viewedBy && viewedBy !== user?.id;
                                        if (img) {
                                          return (
                                            <button key={i} type="button" onClick={() => setLightbox(line)} className="relative my-1 block">
                                              <img src={line} alt="one-time" className="max-h-52 rounded-lg object-cover" />
                                              <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white flex items-center gap-1">
                                                {wasViewed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                {wasViewed ? "Viewed" : "One-time"}
                                              </span>
                                            </button>
                                          );
                                        }
                                        return (
                                          <div key={i} className="my-1 flex items-center gap-2 rounded-lg border border-primary-foreground/30 px-3 py-2 text-xs">
                                            <FileText className="h-4 w-4 shrink-0 opacity-70" />
                                            <span className="truncate flex-1 font-medium">{filenameFromUrl(line)}</span>
                                            <span className="flex items-center gap-1 rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-medium">
                                              {wasViewed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                              {wasViewed ? "Viewed" : "One-time"}
                                            </span>
                                          </div>
                                        );
                                      }
                                      // Recipient: already viewed → locked state.
                                      if (viewedBy) {
                                        return (
                                          <div key={i} className={cn("my-1 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs", "border-border bg-background/50 text-muted-foreground")}>
                                            <EyeOff className="h-3.5 w-3.5" />
                                            {img ? "Photo viewed" : "Document viewed"}
                                          </div>
                                        );
                                      }
                                      // Recipient: first open. Image → lightbox; document → open in new tab.
                                      return (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={async () => {
                                            const ok = await recordOttView(m.id, i);
                                            if (!ok) return; // don't reveal if we couldn't durably mark it viewed
                                            if (img) {
                                              setLightbox(line);
                                            } else if (typeof window !== "undefined") {
                                              window.open(line, "_blank", "noopener,noreferrer");
                                            }
                                          }}
                                          className={cn("my-1 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors", "border-primary/40 bg-primary/10 hover:bg-primary/20")}
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                          {img ? "Tap to view once" : (
                                            <>
                                              <span className="truncate flex-1 text-left">{filenameFromUrl(line)}</span>
                                              <span className="shrink-0">Open once</span>
                                            </>
                                          )}
                                        </button>
                                      );
                                    }
                                    if (img) {
                                      return (
                                        <button key={i} type="button" onClick={() => setLightbox(line)} className="block">
                                          <img src={line} alt="attachment" className="my-1 max-h-52 rounded-lg object-cover" />
                                        </button>
                                      );
                                    }
                                    if (link) {
                                      return (
                                        <a
                                          key={i}
                                          href={line}
                                          target="_blank"
                                          rel="noreferrer"
                                          download
                                          className={cn("my-1 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs no-underline transition-colors", mine ? "border-primary-foreground/30 hover:bg-primary-foreground/10" : "border-border bg-background/60 hover:bg-accent")}
                                        >
                                          <FileText className="h-4 w-4 shrink-0 opacity-70" />
                                          <span className="truncate flex-1 font-medium">{filenameFromUrl(line)}</span>
                                          <Download className="h-3.5 w-3.5 opacity-60" />
                                        </a>
                                      );
                                    }
                                    return (
                                      <p key={i} className="whitespace-pre-wrap break-words leading-snug">
                                        {q ? renderHighlighted(line, q) : line}
                                      </p>
                                    );
                                  })}
                                </div>
                                <span className={cn("ml-auto shrink-0 text-[9px] sm:text-[10px] leading-none pb-0.5", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="border-t p-3"
            >
              {attachment && (
                <div className="mb-2 rounded-lg border bg-muted/40 p-2 text-xs">
                  <div className="flex items-center gap-2">
                    {attachment.type.startsWith("image/") ? (
                      <img
                        src={URL.createObjectURL(attachment)}
                        alt="preview"
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="truncate flex-1">{attachment.name}</span>
                    <span className="text-muted-foreground">
                      {(attachment.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => setOneTime((v) => !v)}
                      disabled={uploading}
                      className={cn(
                        "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors",
                        oneTime
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-accent text-muted-foreground"
                      )}
                      title="View once: recipient can only open it a single time"
                    >
                      {oneTime ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      One-time
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAttachment(null); setOneTime(false); }}
                      disabled={uploading}
                      className="rounded p-1 hover:bg-accent disabled:opacity-50"
                      aria-label="Remove attachment"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {uploading && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all duration-200"
                          style={{ width: `${Math.round(uploadProgress)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Uploading… {Math.round(uploadProgress)}%
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf,.doc,.docx,.txt,.zip"
                  onChange={(e) => {
                    onPickFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  aria-label="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" size="icon" variant="ghost" disabled={sending} aria-label="Insert emoji">
                      <Smile className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="grid grid-cols-8 gap-1">
                      {EMOJIS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => insertEmoji(e)}
                          className="rounded p-1 text-lg hover:bg-accent"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="flex-1">
                  <Textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value.slice(0, MAX_LEN));
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = Math.min(el.scrollHeight, 160) + "px";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Type a message…"
                    disabled={sending}
                    rows={1}
                    className="min-h-[40px] resize-none overflow-hidden [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>{uploading ? "Uploading…" : "Enter to send"}</span>
                    <span>{draft.length}/{MAX_LEN}</span>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={sending || (!draft.trim() && !attachment)}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </>
        )}
      </section>
      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} />
      {active && (
        <VideoCallDialog
          open={videoCallOpen}
          onOpenChange={setVideoCallOpen}
          roomName={`uipair-chat-${active.id}`}
          displayName={user?.email ?? "Student"}
          title={`Call with ${active.other?.full_name || active.other?.username || "Student"}`}
        />
      )}
      <Dialog open={!!lightbox} onOpenChange={(o) => { if (!o) setLightbox(null); }}>
        <DialogContent className="max-w-3xl p-0 bg-transparent border-0 shadow-none">
          {lightbox && (
            <div className="relative">
              <img src={lightbox} alt="preview" className="max-h-[85vh] w-full rounded-lg object-contain" />
              <a
                href={lightbox}
                target="_blank"
                rel="noreferrer"
                download
                className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md bg-black/70 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/85"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

