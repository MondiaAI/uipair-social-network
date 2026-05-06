import { useEffect, useState } from "react";
import { Megaphone, Pin, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  user_id: string;
}

export function CircleAnnouncements({
  circleId,
  isLeader,
  userId,
}: {
  circleId: string;
  isLeader: boolean;
  userId: string | undefined;
}) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("circle_announcements")
      .select("id,title,content,created_at,user_id")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Announcement[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [circleId]);

  const post = async () => {
    if (!userId || !title.trim() || !content.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("circle_announcements").insert({
      circle_id: circleId,
      user_id: userId,
      title: title.trim(),
      content: content.trim(),
    });
    setPosting(false);
    if (error) { toast.error(error.message); return; }
    setTitle(""); setContent("");
    toast.success("Announcement posted");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    setDeletingId(id);
    const { error } = await supabase.from("circle_announcements").delete().eq("id", id);
    setDeletingId(null);
    if (error) { toast.error(error.message); return; }
    setItems((prev) => prev.filter((a) => a.id !== id));
    toast.success("Deleted");
  };

  if (loading) return null;
  if (!isLeader && items.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4 mb-6 space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-sm">Announcements</h2>
      </div>

      {isLeader && (
        <div className="rounded-md border border-dashed p-3 space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title…" />
          <Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Share an update with everyone in this circle…" />
          <div className="flex justify-end">
            <Button size="sm" onClick={post} disabled={posting || !title.trim() || !content.trim()}>
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pin className="h-4 w-4" />}
              Post announcement
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No announcements yet.</p>
      ) : items.map((a) => (
        <div key={a.id} className="rounded-md border-l-4 border-primary bg-primary/5 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <Pin className="h-3 w-3 text-primary" />
                <p className="font-semibold text-sm">{a.title}</p>
              </div>
              <p className="text-sm whitespace-pre-wrap">{a.content}</p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
              </p>
            </div>
            {isLeader && (
              <Button size="sm" variant="ghost" onClick={() => remove(a.id)} disabled={deletingId === a.id}>
                {deletingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
