import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Calendar, MapPin, ArrowLeft, Check, X, HelpCircle,
  Link as LinkIcon, Megaphone, Trash2, Newspaper,
} from "lucide-react";
import { useDataLight } from "@/lib/data-light";
import { Linkify } from "@/components/peerly/Linkify";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/events/$eventId")({
  component: EventDetailsPage,
  head: () => ({
    meta: [{ title: "Event · UiPair" }],
  }),
});

type RsvpStatus = "yes" | "no" | "maybe";

interface EventDetails {
  id: string;
  title: string;
  description: string | null;
  agenda: string | null;
  category: string;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_url: string | null;
  rsvp_count: number;
  creator_id: string;
  university: string;
  event_url: string | null;
}

interface Organizer {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  university: string | null;
}

interface Announcement {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
}

interface CampusPost {
  id: string;
  content: string;
  post_type: string;
  created_at: string;
  user_id: string;
  author: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  party: "🎉 Party",
  academic: "📚 Academic",
  sports: "⚽ Sports",
  club: "🎭 Club",
  career: "💼 Career",
  cultural: "🌍 Cultural",
  volunteer: "🤝 Volunteer",
  other: "✨ Other",
};

function normalizeUrl(u: string) {
  if (!u) return u;
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

function EventDetailsPage() {
  const { eventId } = Route.useParams();
  const { user, profile } = useAuth() as any;
  const dataLight = useDataLight();
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [organizer, setOrganizer] = useState<Organizer | null>(null);
  const [myStatus, setMyStatus] = useState<RsvpStatus | null>(null);
  const [counts, setCounts] = useState({ yes: 0, no: 0, maybe: 0 });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [postingAnn, setPostingAnn] = useState(false);
  const [campusPosts, setCampusPosts] = useState<CampusPost[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: ev } = await supabase
      .from("campus_events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();
    if (!ev) {
      setEvent(null);
      setLoading(false);
      return;
    }
    setEvent(ev as EventDetails);

    const [{ data: org }, { data: rsvps }, { data: myRsvp }, { data: anns }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, university")
        .eq("id", (ev as EventDetails).creator_id)
        .maybeSingle(),
      supabase.from("event_rsvps").select("status").eq("event_id", eventId),
      user
        ? supabase
            .from("event_rsvps")
            .select("status")
            .eq("event_id", eventId)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase
        .from("event_announcements")
        .select("id, content, created_at, user_id")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false }),
    ]);
    setOrganizer((org ?? null) as Organizer | null);
    const c = { yes: 0, no: 0, maybe: 0 };
    for (const r of rsvps ?? []) {
      const s = (r as { status: RsvpStatus }).status;
      if (s in c) c[s] += 1;
    }
    setCounts(c);
    setMyStatus(((myRsvp as { status?: RsvpStatus } | null)?.status as RsvpStatus | null) ?? null);
    setAnnouncements((anns ?? []) as Announcement[]);
    setLoading(false);
  }, [eventId, user]);

  // Local-campus feed: only show when viewer is at the same campus as the event
  const loadCampusFeed = useCallback(async (university: string) => {
    const { data } = await supabase
      .from("posts")
      .select("id, content, post_type, created_at, user_id, author:profiles!posts_user_id_fkey(full_name, username, avatar_url)")
      .eq("university", university)
      .order("created_at", { ascending: false })
      .limit(6);
    setCampusPosts((data ?? []) as unknown as CampusPost[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (event && profile?.university && event.university === profile.university) {
      loadCampusFeed(event.university);
    } else {
      setCampusPosts([]);
    }
  }, [event, profile?.university, loadCampusFeed]);

  const setStatus = async (status: RsvpStatus | null) => {
    if (!user) {
      toast.error("Sign in to RSVP");
      return;
    }
    setUpdating(true);
    const prev = myStatus;
    const prevCounts = counts;
    const nextCounts = { ...counts };
    if (prev) nextCounts[prev] = Math.max(0, nextCounts[prev] - 1);
    if (status) nextCounts[status] += 1;
    setMyStatus(status);
    setCounts(nextCounts);
    if (event) setEvent({ ...event, rsvp_count: nextCounts.yes });

    let error: any = null;
    if (status === null) {
      ({ error } = await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", user.id));
    } else {
      ({ error } = await supabase
        .from("event_rsvps")
        .upsert({ event_id: eventId, user_id: user.id, status }, { onConflict: "event_id,user_id" }));
    }
    setUpdating(false);
    if (error) {
      toast.error("Couldn't update RSVP");
      setMyStatus(prev);
      setCounts(prevCounts);
      if (event) setEvent({ ...event, rsvp_count: prevCounts.yes });
    }
  };

  const isOrganizer = !!user && !!event && event.creator_id === user.id;

  const postAnnouncement = async () => {
    if (!user || !event) return;
    const content = newAnnouncement.trim();
    if (!content) return;
    setPostingAnn(true);
    const { data, error } = await supabase
      .from("event_announcements")
      .insert({ event_id: event.id, user_id: user.id, content })
      .select("id, content, created_at, user_id")
      .single();
    setPostingAnn(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAnnouncements((prev) => [data as Announcement, ...prev]);
    setNewAnnouncement("");
    toast.success("Announcement posted");
  };

  const deleteAnnouncement = async (id: string) => {
    const prev = announcements;
    setAnnouncements((a) => a.filter((x) => x.id !== id));
    const { error } = await supabase.from("event_announcements").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't delete");
      setAnnouncements(prev);
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">Loading event…</div>;
  }
  if (!event) {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-3">
        <p className="text-muted-foreground">Event not found.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/events">Back to events</Link>
        </Button>
      </div>
    );
  }

  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const dateStr = start.toLocaleString(undefined, {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const endStr = end ? end.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" }) : null;
  const orgName = organizer?.full_name || organizer?.username || "Organizer";
  const orgInitials = orgName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const sameCampus = !!profile?.university && profile.university === event.university;

  return (
    <div className="mx-auto w-full max-w-2xl px-3 sm:px-4 py-3 sm:py-6 space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/events"><ArrowLeft className="h-4 w-4" /> All events</Link>
      </Button>

      <article className="rounded-2xl border bg-card overflow-hidden">
        {event.cover_url && !dataLight && (
          <img src={event.cover_url} alt="" className="h-56 w-full object-cover" loading="lazy" />
        )}
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5">{CATEGORY_LABEL[event.category] ?? event.category}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> {dateStr}{endStr ? ` – ${endStr}` : ""}
            </span>
            {event.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {event.location}
              </span>
            )}
          </div>
          {event.event_url && (
            <a
              href={normalizeUrl(event.event_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline break-all"
            >
              <LinkIcon className="h-4 w-4" /> {event.event_url}
            </a>
          )}
          {event.description && (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              <Linkify text={event.description} />
            </p>
          )}
        </div>
      </article>

      <section className="rounded-2xl border bg-card p-5 space-y-3">
        <h2 className="font-semibold">Your RSVP</h2>
        <div className="grid grid-cols-3 gap-2">
          <RsvpButton active={myStatus === "yes"} onClick={() => setStatus(myStatus === "yes" ? null : "yes")}
            icon={<Check className="h-4 w-4" />} label="Yes" count={counts.yes} disabled={updating} tone="primary" />
          <RsvpButton active={myStatus === "maybe"} onClick={() => setStatus(myStatus === "maybe" ? null : "maybe")}
            icon={<HelpCircle className="h-4 w-4" />} label="Maybe" count={counts.maybe} disabled={updating} tone="muted" />
          <RsvpButton active={myStatus === "no"} onClick={() => setStatus(myStatus === "no" ? null : "no")}
            icon={<X className="h-4 w-4" />} label="No" count={counts.no} disabled={updating} tone="muted" />
        </div>
        {myStatus && (
          <p className="text-xs text-muted-foreground">
            You're marked as <strong>{myStatus}</strong>. Tap again to clear.
          </p>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Announcements</h2>
          <span className="text-xs text-muted-foreground">({announcements.length})</span>
        </div>
        {isOrganizer && (
          <div className="space-y-2">
            <Textarea
              value={newAnnouncement}
              onChange={(e) => setNewAnnouncement(e.target.value)}
              placeholder="Post an update for attendees…"
              maxLength={2000}
              rows={3}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={postAnnouncement} disabled={postingAnn || !newAnnouncement.trim()}>
                {postingAnn ? "Posting…" : "Post announcement"}
              </Button>
            </div>
          </div>
        )}
        {announcements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          <ul className="space-y-2">
            {announcements.map((a) => (
              <li key={a.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap leading-relaxed flex-1">
                    <Linkify text={a.content} />
                  </p>
                  {isOrganizer && (
                    <button
                      type="button"
                      onClick={() => deleteAnnouncement(a.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete announcement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {event.agenda && (
        <section className="rounded-2xl border bg-card p-5 space-y-2">
          <h2 className="font-semibold">Agenda</h2>
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
            <Linkify text={event.agenda} />
          </p>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-5 space-y-3">
        <h2 className="font-semibold">Organizer</h2>
        {organizer ? (
          <Link
            to="/profile/$userId"
            params={{ userId: organizer.id }}
            className="flex items-center gap-3 rounded-lg p-2 -mx-2 hover:bg-muted transition"
          >
            <Avatar className="h-12 w-12">
              <AvatarImage src={organizer.avatar_url ?? undefined} />
              <AvatarFallback>{orgInitials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium truncate">{orgName}</p>
              {organizer.username && <p className="text-xs text-muted-foreground truncate">@{organizer.username}</p>}
              {organizer.university && <p className="text-xs text-muted-foreground truncate">{organizer.university}</p>}
            </div>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">Unknown organizer</p>
        )}
      </section>

      {sameCampus && (
        <section className="rounded-2xl border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">From your campus</h2>
            <span className="text-xs text-muted-foreground">{event.university}</span>
          </div>
          {campusPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent posts from your campus.</p>
          ) : (
            <ul className="space-y-2">
              {campusPosts.map((p) => {
                const name = p.author?.full_name || p.author?.username || "Student";
                const initials = name.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <li key={p.id} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={p.author?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">{name}</span>
                      <span className="text-xs text-muted-foreground">
                        · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap line-clamp-4 leading-relaxed">{p.content}</p>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="pt-1">
            <Button asChild variant="outline" size="sm">
              <Link to="/feed">Open campus feed</Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function RsvpButton({
  active, onClick, icon, label, count, disabled, tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  disabled: boolean;
  tone: "primary" | "muted";
}) {
  const base = "flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-sm font-medium transition disabled:opacity-50";
  const activeCls = tone === "primary"
    ? "border-primary bg-primary text-primary-foreground"
    : "border-foreground/40 bg-accent text-foreground";
  const inactiveCls = "bg-card hover:bg-muted text-foreground";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${active ? activeCls : inactiveCls}`}>
      <span className="flex items-center gap-1.5">{icon}{label}</span>
      <span className={`text-xs ${active ? "" : "text-muted-foreground"}`}>{count}</span>
    </button>
  );
}
