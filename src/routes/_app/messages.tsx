import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare, Paperclip, Smile, X, FileText, Image as ImageIcon, Bell, BellOff, CheckCheck, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
}

function MessagesPage() {
  const { user } = useAuth();
  const { c: activeId, m: prefill } = Route.useSearch();
  const navigate = useNavigate({ from: "/messages" });
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [search, setSearch] = useState("");
  const [muted, setMuted] = useState<Record<string, boolean>>({});
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

  // Plain-text preview for sidebar (only works for messages decryptable on this device).
  const previewText = (content: string | undefined): string => {
    if (!content) return "Say hi 👋";
    if (!isEncrypted(content)) return content;
    const r = decryptMessage(content, keypair, null);
    return r.ok ? r.plaintext : "🔒 Encrypted message";
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
  const isImageUrl = (s: string) => /\.(png|jpe?g|gif|webp|avif)$/i.test(s.trim());

  // Apply prefill from query string once per active conversation
  useEffect(() => {
    if (prefill) {
      setDraft(prefill);
      navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, m: undefined }), replace: true });
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
      .channel(`conv_list:${user.id}`)
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
      .channel(`mutes:${user.id}`)
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
      return;
    }
    // Clear unread badge immediately when opening a conversation
    setConversations((prev) => prev.map((c) => c.id === activeId ? { ...c, unread: 0 } : c));
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, created_at, read_at")
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
      .channel(`messages:${activeId}`)
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
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId]);

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
        const path = `${user.id}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("resources").upload(path, file);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("resources").createSignedUrl(path, 60 * 60 * 24 * 7);
        if (signed?.signedUrl) {
          content = content ? `${content}\n${signed.signedUrl}` : signed.signedUrl;
        }
        setUploadProgress(100);
      }
      // E2EE required: never send plaintext. Block until keys are ready.
      let payload: string;
      let recipientPub = counterpartPub;
      if (!recipientPub) {
        const conv = conversations.find((c) => c.id === activeId);
        const otherId = conv ? (conv.user_a === user.id ? conv.user_b : conv.user_a) : null;
        recipientPub = otherId ? await fetchPublicKey(otherId) : null;
        if (recipientPub) setCounterpartPub(recipientPub);
      }
      if (!keypair || !recipientPub) {
        toast.error("Can't send: end-to-end encryption keys aren't available for this chat yet.");
        setDraft(originalDraft);
        setAttachment(originalAttachment);
        return;
      }
      payload = encryptMessage(content, recipientPub, keypair);
      const { error } = await supabase
        .from("messages")
        .insert({ conversation_id: activeId, sender_id: user.id, content: payload });
      if (error) throw error;
      // Only clear draft + attachment after a fully successful send
      setDraft("");
      setAttachment(null);
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
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-5xl gap-4 px-4 py-6">
      {/* Sidebar */}
      <aside className="flex w-72 flex-col rounded-xl border bg-card shadow-sm">
        <div className="border-b p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold">Messages</h1>
            {(() => {
              const total = conversations.reduce((s, c) => s + (muted[c.id] ? 0 : (c.unread ?? 0)), 0);
              return total > 0 ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  {total} new
                </span>
              ) : null;
            })()}
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
                  No conversations yet. Connect with a study partner first.
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
              return (
                <button
                  key={c.id}
                  onClick={() => navigate({ search: { c: c.id } })}
                  className={cn(
                    "flex w-full items-center gap-3 border-b p-3 text-left transition-colors hover:bg-accent",
                    isActive && "bg-accent"
                  )}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={c.other?.avatar_url ?? undefined} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("truncate text-sm flex items-center gap-1 min-w-0", unread > 0 && !muted[c.id] ? "font-bold" : "font-medium")}>
                        {muted[c.id] && <BellOff className="h-3 w-3 text-muted-foreground" />}
                        <span className="truncate">{name}</span>
                        
                      </p>
                      {unread > 0 && (
                        <span className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          muted[c.id] ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                        )}>
                          {unread}
                        </span>
                      )}
                    </div>
                    <p className={cn("truncate text-xs", unread > 0 && !muted[c.id] ? "text-foreground" : "text-muted-foreground")}>
                      {previewText(c.preview)}
                    </p>
                  </div>
                </button>
              );
            });
          })()}
        </div>
      </aside>

      {/* Chat panel */}
      <section className="flex flex-1 flex-col rounded-xl border bg-card shadow-sm">
        {!active ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a conversation to start chatting
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b p-4">
              <Avatar className="h-9 w-9">
                <AvatarImage src={active.other?.avatar_url ?? undefined} />
                <AvatarFallback>
                  {(active.other?.full_name || active.other?.username || "S").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {active.other?.full_name || active.other?.username || "Student"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {muted[active.id] ? "Notifications muted" : "Private chat"}
                </p>
              </div>
              
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

            <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {(() => {
                const visible = messages.filter((m) => isEncrypted(m.content));
                const hiddenCount = messages.length - visible.length;
                if (visible.length === 0) {
                  return (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {hiddenCount > 0
                        ? `${hiddenCount} unencrypted message${hiddenCount === 1 ? "" : "s"} hidden.`
                        : "No messages yet. Send the first one!"}
                    </p>
                  );
                }
                return (
                  <>
                    {hiddenCount > 0 && (
                      <p className="text-center text-[11px] text-muted-foreground">
                        {hiddenCount} unencrypted message{hiddenCount === 1 ? "" : "s"} hidden
                      </p>
                    )}
                    {visible.map((m) => {
                      const mine = m.sender_id === user?.id;
                      const decrypted = decryptContent(m.content);
                      const displayText = decrypted.ok ? decrypted.plaintext : "";
                      const showFallback = !decrypted.ok;
                      return (
                        <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                              mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                            )}
                          >
                            {showFallback ? (
                              <p className={cn("italic", mine ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                {fallbackLabel(decrypted.reason)}
                              </p>
                            ) : (
                              displayText.split("\n").map((line, i) =>
                                isImageUrl(line) ? (
                                  <a key={i} href={line} target="_blank" rel="noreferrer" className="block">
                                    <img src={line} alt="attachment" className="my-1 max-h-60 rounded-lg object-cover" />
                                  </a>
                                ) : /^https?:\/\//i.test(line) ? (
                                  <a key={i} href={line} target="_blank" rel="noreferrer" className="block break-all underline underline-offset-2">
                                    {line}
                                  </a>
                                ) : (
                                  <p key={i} className="whitespace-pre-wrap break-words">
                                    {line}
                                  </p>
                                )
                              )
                            )}
                            <p className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                              {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                            </p>
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
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="truncate flex-1">{attachment.name}</span>
                    <span className="text-muted-foreground">
                      {(attachment.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
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
                    onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Type a message… (Shift+Enter for newline)"
                    disabled={sending}
                    rows={1}
                    className="max-h-32 min-h-[40px] resize-none"
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
    </div>
  );
}
