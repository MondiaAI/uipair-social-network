import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Calendar, MapPin, ArrowLeft, Check, X, HelpCircle } from "lucide-react";
import { useDataLight } from "@/lib/data-light";
import { Linkify } from "@/components/peerly/Linkify";

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
}

interface Organizer {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  university: string | null;
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

function EventDetailsPage() {
  const { eventId } = Route.useParams();
  const { user } = useAuth();
  const dataLight = useDataLight();
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [organizer, setOrganizer] = useState<Organizer | null>(null);
  const [myStatus, setMyStatus] = useState<RsvpStatus | null>(null);
  const [counts, setCounts] = useState({ yes: 0, no: 0, maybe: 0 });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

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

    const [{ data: org }, { data: rsvps }, { data: myRsvp }] = await Promise.all([
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
    ]);
    setOrganizer((org ?? null) as Organizer | null);
    const c = { yes: 0, no: 0, maybe: 0 };
    for (const r of rsvps ?? []) {
      const s = (r as { status: RsvpStatus }).status;
      if (s in c) c[s] += 1;
    }
    setCounts(c);
    setMyStatus(((myRsvp as { status?: RsvpStatus } | null)?.status as RsvpStatus | null) ?? null);
    setLoading(false);
  }, [eventId, user]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (status: RsvpStatus | null) => {
    if (!user) {
      toast.error("Sign in to RSVP");
      return;
    }
    setUpdating(true);
    const prev = myStatus;
    const prevCounts = counts;
    // optimistic
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
