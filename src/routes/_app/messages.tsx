import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare, Paperclip, Smile, X, FileText, Image as ImageIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

const EMOJIS = ["😀","😂","😍","🥲","🙌","👍","🎉","🔥","💯","🤔","😎","🙏","❤️","👀","✅","🚀","📚","☕","🌙","✨"];
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const search = z.object({ c: z.string().uuid().optional(), m: z.string().optional() });

export const Route = createFileRoute("/_app/messages")({
  validateSearch: (s) => search.parse(s),
  component: MessagesPage,
});

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Load active conversation messages + subscribe
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
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
      const { error } = await supabase
        .from("messages")
        .insert({ conversation_id: activeId, sender_id: user.id, content });
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
        <div className="border-b p-4">
          <h1 className="text-lg font-bold">Messages</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No conversations yet. Connect with a study partner first.
            </div>
          ) : (
            conversations.map((c) => {
              const name = c.other?.full_name || c.other?.username || "Student";
              const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
              const isActive = c.id === activeId;
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
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.preview ?? "Say hi 👋"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
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
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {active.other?.full_name || active.other?.username || "Student"}
                </p>
                <p className="text-xs text-muted-foreground">Private chat</p>
              </div>
            </header>

            <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No messages yet. Send the first one!
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={cn("flex", mine ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                          mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {m.content.split("\n").map((line, i) =>
                          isImageUrl(line) ? (
                            <a key={i} href={line} target="_blank" rel="noreferrer" className="block">
                              <img
                                src={line}
                                alt="attachment"
                                className="my-1 max-h-60 rounded-lg object-cover"
                              />
                            </a>
                          ) : /^https?:\/\//i.test(line) ? (
                            <a
                              key={i}
                              href={line}
                              target="_blank"
                              rel="noreferrer"
                              className="block break-all underline underline-offset-2"
                            >
                              {line}
                            </a>
                          ) : (
                            <p key={i} className="whitespace-pre-wrap break-words">
                              {line}
                            </p>
                          )
                        )}
                        <p className={cn(
                          "mt-1 text-[10px]",
                          mine ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
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
