import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Calendar, MapPin, Users as UsersIcon, Plus } from "lucide-react";
import { useDataLight } from "@/lib/data-light";

export const Route = createFileRoute("/_app/events")({
  component: EventsPage,
  head: () => ({
    meta: [
      { title: "Campus Events · UiPair" },
      { name: "description", content: "Discover and post events on your campus." },
    ],
  }),
});

const CATEGORIES = [
  { value: "party", label: "🎉 Party" },
  { value: "academic", label: "📚 Academic" },
  { value: "sports", label: "⚽ Sports" },
  { value: "club", label: "🎭 Club" },
  { value: "career", label: "💼 Career" },
  { value: "cultural", label: "🌍 Cultural" },
  { value: "volunteer", label: "🤝 Volunteer" },
  { value: "other", label: "✨ Other" },
] as const;

interface CampusEvent {
  id: string;
  title: string;
  description: string | null;
  category: string;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_url: string | null;
  rsvp_count: number;
  creator_id: string;
  university: string;
}

function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function EventsPage() {
  const { user, profile } = useAuth();
  const dataLight = useDataLight();
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [rsvpIds, setRsvpIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.university) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("campus_events")
      .select("*")
      .eq("university", profile.university)
      .gte("starts_at", new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString())
      .order("starts_at", { ascending: true });
    setEvents((data ?? []) as CampusEvent[]);
    if (user) {
      const { data: rsvps } = await supabase
        .from("event_rsvps")
        .select("event_id")
        .eq("user_id", user.id);
      setRsvpIds(new Set((rsvps ?? []).map((r) => r.event_id)));
    }
    setLoading(false);
  }, [profile?.university, user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRsvp = async (ev: CampusEvent) => {
    if (!user) return;
    const going = rsvpIds.has(ev.id);
    if (going) {
      const next = new Set(rsvpIds);
      next.delete(ev.id);
      setRsvpIds(next);
      setEvents((es) => es.map((e) => (e.id === ev.id ? { ...e, rsvp_count: Math.max(0, e.rsvp_count - 1) } : e)));
      const { error } = await supabase.from("event_rsvps").delete().eq("event_id", ev.id).eq("user_id", user.id);
      if (error) {
        toast.error("Couldn't update RSVP");
        load();
      }
    } else {
      const next = new Set(rsvpIds);
      next.add(ev.id);
      setRsvpIds(next);
      setEvents((es) => es.map((e) => (e.id === ev.id ? { ...e, rsvp_count: e.rsvp_count + 1 } : e)));
      const { error } = await supabase.from("event_rsvps").insert({ event_id: ev.id, user_id: user.id });
      if (error) {
        toast.error("Couldn't RSVP");
        load();
      }
    }
  };

  const filtered = filter === "all" ? events : events.filter((e) => e.category === filter);

  return (
    <div className="mx-auto w-full max-w-2xl px-3 sm:px-4 py-3 sm:py-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campus Events</h1>
          <p className="text-sm text-muted-foreground">
            {profile?.university ? `Happening at ${profile.university}` : "Add your university in settings to see events"}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!profile?.university} size="sm">
          <Plus className="h-4 w-4" /> Post event
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {[{ value: "all", label: "All" }, ...CATEGORIES].map((c) => {
          const active = filter === c.value;
          return (
            <button
              key={c.value}
              onClick={() => setFilter(c.value)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted text-muted-foreground"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Loading events…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">No upcoming events. Post the first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              going={rsvpIds.has(ev.id)}
              onToggleRsvp={() => toggleRsvp(ev)}
              dataLight={dataLight}
            />
          ))}
        </div>
      )}

      <CreateEventModal open={open} onOpenChange={setOpen} onCreated={load} />
    </div>
  );
}

function EventCard({
  event,
  going,
  onToggleRsvp,
  dataLight,
}: {
  event: CampusEvent;
  going: boolean;
  onToggleRsvp: () => void;
  dataLight: boolean;
}) {
  const start = new Date(event.starts_at);
  const dateStr = start.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <article className="rounded-2xl border bg-card overflow-hidden">
      {event.cover_url && !dataLight && (
        <img src={event.cover_url} alt="" className="h-40 w-full object-cover" loading="lazy" />
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">{categoryLabel(event.category)}</span>
        </div>
        <h2 className="text-lg font-semibold leading-tight">{event.title}</h2>
        {event.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground pt-1">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-4 w-4" /> {dateStr}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {event.location}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <UsersIcon className="h-4 w-4" /> {event.rsvp_count} going
          </span>
        </div>
        <div className="pt-2">
          <Button variant={going ? "secondary" : "default"} size="sm" onClick={onToggleRsvp}>
            {going ? "Going ✓" : "RSVP"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function CreateEventModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const { user, profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle(""); setDescription(""); setCategory("other"); setLocation("");
    setStartsAt(""); setEndsAt(""); setCoverFile(null);
  };

  const submit = async () => {
    if (!user || !profile?.university) return;
    if (!title.trim() || !startsAt) {
      toast.error("Title and start time are required");
      return;
    }
    setSubmitting(true);
    let cover_url: string | null = null;
    if (coverFile) {
      const ext = coverFile.name.split(".").pop() || "jpg";
      const path = `events/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("post-media").upload(path, coverFile, { upsert: false });
      if (upErr) {
        toast.error("Couldn't upload cover image");
        setSubmitting(false);
        return;
      }
      cover_url = supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("campus_events").insert({
      creator_id: user.id,
      university: profile.university,
      tenant_id: profile.tenant_id ?? null,
      title: title.trim(),
      description: description.trim() || null,
      category,
      location: location.trim() || null,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      cover_url,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event posted!");
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post a campus event</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. End-of-semester rooftop party" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} placeholder="What's happening?" />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} placeholder="e.g. Student Union, Room 204" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Starts</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <Label>Ends (optional)</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Cover image (optional)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button onClick={submit} disabled={submitting || !title.trim() || !startsAt} className="w-full">
            {submitting ? "Posting…" : "Post event"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
