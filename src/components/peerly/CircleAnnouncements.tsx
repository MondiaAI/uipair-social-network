import { useEffect, useState } from "react";
import { Megaphone, Pin, PinOff, Trash2, Loader2, Pencil, X, Check } from "lucide-react";
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
  is_pinned: boolean;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);

  const sortItems = (arr: Announcement[]) =>
    [...arr].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("circle_announcements")
      .select("id,title,content,created_at,user_id,is_pinned")
      .eq("circle_id", circleId);
    setItems(sortItems((data ?? []) as Announcement[]));
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

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setEditTitle(a.title);
    setEditContent(a.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim() || !editContent.trim()) return;
    const newTitle = editTitle.trim();
    const newContent = editContent.trim();
    const prev = items;
    // Optimistic
    setItems((curr) => sortItems(curr.map((a) => a.id === id ? { ...a, title: newTitle, content: newContent } : a)));
    cancelEdit();
    setSavingId(id);
    const { error } = await supabase
      .from("circle_announcements")
      .update({ title: newTitle, content: newContent })
      .eq("id", id);
    setSavingId(null);
    if (error) {
      setItems(prev); // rollback
      toast.error(error.message);
      return;
    }
    toast.success("Announcement updated");
  };

  const togglePin = async (a: Announcement) => {
    const next = !a.is_pinned;
    const prev = items;
    // Optimistic
    setItems((curr) => sortItems(curr.map((x) => x.id === a.id ? { ...x, is_pinned: next } : x)));
    setPinningId(a.id);
    const { error } = await supabase
      .from("circle_announcements")
      .update({ is_pinned: next })
      .eq("id", a.id);
    setPinningId(null);
    if (error) {
      setItems(prev); // rollback
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Pinned" : "Unpinned");
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
        <div key={a.id} className={`rounded-md border-l-4 p-3 ${a.is_pinned ? "border-primary bg-primary/5" : "border-muted bg-muted/30"}`}>
          {editingId === a.id ? (
            <div className="space-y-2">
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" />
              <Textarea rows={3} value={editContent} onChange={(e) => setEditContent(e.target.value)} placeholder="Content" />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={savingId === a.id}>
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={() => saveEdit(a.id)} disabled={savingId === a.id || !editTitle.trim() || !editContent.trim()}>
                  {savingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  {a.is_pinned ? <Pin className="h-3 w-3 text-primary" /> : <PinOff className="h-3 w-3 text-muted-foreground" />}
                  <p className="font-semibold text-sm">{a.title}</p>
                </div>
                <p className="text-sm whitespace-pre-wrap">{a.content}</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                </p>
              </div>
              {isLeader && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => togglePin(a)} disabled={pinningId === a.id} title={a.is_pinned ? "Unpin" : "Pin"}>
                    {pinningId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : a.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(a)} title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(a.id)} disabled={deletingId === a.id} title="Delete">
                    {deletingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
