import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Calendar, MapPin, Users as UsersIcon, Plus, Loader2, CheckCircle2, AlertCircle, RefreshCw, X, ImageOff } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useDataLight } from "@/lib/data-light";
import { uploadToBucketDetailed } from "@/lib/storage";

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
  const [myStatusByEvent, setMyStatusByEvent] = useState<Record<string, "yes" | "no" | "maybe">>({});
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
        .select("event_id, status")
        .eq("user_id", user.id);
      const map: Record<string, "yes" | "no" | "maybe"> = {};
      for (const r of rsvps ?? []) {
        map[(r as { event_id: string }).event_id] = (r as { status: "yes" | "no" | "maybe" }).status;
      }
      setMyStatusByEvent(map);
    }
    setLoading(false);
  }, [profile?.university, user]);

  useEffect(() => {
    load();
  }, [load]);

  const quickYes = async (ev: CampusEvent) => {
    if (!user) return;
    const current = myStatusByEvent[ev.id];
    const isYes = current === "yes";
    const next = { ...myStatusByEvent };
    if (isYes) delete next[ev.id];
    else next[ev.id] = "yes";
    setMyStatusByEvent(next);
    setEvents((es) => es.map((e) => {
      if (e.id !== ev.id) return e;
      const wasYes = current === "yes";
      const willYes = !isYes;
      const d = (willYes ? 1 : 0) - (wasYes ? 1 : 0);
      return { ...e, rsvp_count: Math.max(0, e.rsvp_count + d) };
    }));
    let error: any = null;
    if (isYes) {
      ({ error } = await supabase.from("event_rsvps").delete().eq("event_id", ev.id).eq("user_id", user.id));
    } else {
      ({ error } = await supabase
        .from("event_rsvps")
        .upsert({ event_id: ev.id, user_id: user.id, status: "yes" }, { onConflict: "event_id,user_id" }));
    }
    if (error) {
      toast.error("Couldn't update RSVP");
      load();
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
              myStatus={myStatusByEvent[ev.id] ?? null}
              onQuickYes={() => quickYes(ev)}
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
  myStatus,
  onQuickYes,
  dataLight,
}: {
  event: CampusEvent;
  myStatus: "yes" | "no" | "maybe" | null;
  onQuickYes: () => void;
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
  const isYes = myStatus === "yes";
  return (
    <article className="rounded-2xl border bg-card overflow-hidden">
      {event.cover_url && !dataLight && (
        <Link to="/events/$eventId" params={{ eventId: event.id }} className="block">
          <img src={event.cover_url} alt="" className="h-40 w-full object-cover" loading="lazy" />
        </Link>
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">{categoryLabel(event.category)}</span>
        </div>
        <Link to="/events/$eventId" params={{ eventId: event.id }} className="block group">
          <h2 className="text-lg font-semibold leading-tight group-hover:underline">{event.title}</h2>
        </Link>
        {event.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{event.description}</p>}
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
        <div className="pt-2 flex items-center gap-2">
          <Button variant={isYes ? "secondary" : "default"} size="sm" onClick={onQuickYes}>
            {isYes ? "Going ✓" : myStatus === "maybe" ? "Maybe · Tap to go" : myStatus === "no" ? "Not going · Tap to go" : "RSVP yes"}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/events/$eventId" params={{ eventId: event.id }}>Details</Link>
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
  const [agenda, setAgenda] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle(""); setDescription(""); setCategory("other"); setLocation("");
    setStartsAt(""); setEndsAt(""); setAgenda("");
    setCoverFile(null); setCoverUrl(null);
    setUploadState("idle"); setUploadProgress(0); setUploadError(null);
  };

  const startUpload = useCallback(async (file: File) => {
    if (!user) return;
    setUploadState("uploading");
    setUploadProgress(8);
    setUploadError(null);
    // Indeterminate-ish progress: tick toward 90% while the SDK upload runs.
    const tick = window.setInterval(() => {
      setUploadProgress((p) => (p < 90 ? p + Math.max(1, Math.round((90 - p) / 8)) : p));
    }, 200);
    const { url, error } = await uploadToBucketDetailed("post-media", user.id, file);
    window.clearInterval(tick);
    if (error || !url) {
      setUploadProgress(0);
      setUploadState("error");
      setUploadError(error || "Upload failed");
      return;
    }
    setCoverUrl(url);
    setUploadProgress(100);
    setUploadState("success");
  }, [user]);

  const onPickFile = (file: File | null) => {
    setCoverFile(file);
    setCoverUrl(null);
    setUploadError(null);
    setUploadProgress(0);
    setUploadState("idle");
    if (file) void startUpload(file);
  };

  const clearCover = () => {
    setCoverFile(null);
    setCoverUrl(null);
    setUploadError(null);
    setUploadProgress(0);
    setUploadState("idle");
  };

  const submit = async () => {
    if (!user || !profile?.university) return;
    if (!title.trim() || !startsAt) {
      toast.error("Title and start time are required");
      return;
    }
    if (coverFile && uploadState !== "success") {
      toast.error(uploadState === "uploading" ? "Wait for the cover image upload to finish" : "Retry the cover image upload or remove it");
      return;
    }
    setSubmitting(true);
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
      agenda: agenda.trim() || null,
      cover_url: coverUrl,
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
            <Label>Agenda (optional)</Label>
            <Textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={4} maxLength={5000} placeholder="6:00 PM — Doors open&#10;6:30 PM — Keynote&#10;7:30 PM — Networking" />
          </div>
          <div className="space-y-2">
            <Label>Cover image (optional)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              disabled={uploadState === "uploading"}
            />
            {coverFile && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{coverFile.name}</span>
                  <button
                    type="button"
                    onClick={clearCover}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Remove cover image"
                    disabled={uploadState === "uploading"}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {uploadState === "uploading" && (
                  <>
                    <Progress value={uploadProgress} className="h-1.5" />
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading… {uploadProgress}%
                    </p>
                  </>
                )}
                {uploadState === "success" && (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Upload complete
                  </p>
                )}
                {uploadState === "error" && (
                  <div className="space-y-1.5">
                    <p className="flex items-start gap-1.5 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{uploadError ?? "Upload failed"}</span>
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => coverFile && startUpload(coverFile)}
                      className="h-7 text-xs"
                    >
                      <RefreshCw className="h-3 w-3" /> Retry upload
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <Button
            onClick={submit}
            disabled={submitting || !title.trim() || !startsAt || uploadState === "uploading"}
            className="w-full"
          >
            {submitting ? "Posting…" : uploadState === "uploading" ? "Uploading cover…" : "Post event"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
