import { supabase } from "@/integrations/supabase/client";
import { uploadPrivateFileForSignedUrl } from "@/lib/storage";

export type FriendStatus =
  | "none"
  | "outgoing_pending"
  | "incoming_pending"
  | "friends"
  | "declined";

export interface FriendEdge {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined" | "canceled";
}

export function deriveStatus(edge: FriendEdge | null, me: string): FriendStatus {
  if (!edge) return "none";
  if (edge.status === "accepted") return "friends";
  if (edge.status === "declined" || edge.status === "canceled") return "none";
  if (edge.status === "pending") {
    return edge.sender_id === me ? "outgoing_pending" : "incoming_pending";
  }
  return "none";
}

export async function sendFriendRequest(senderId: string, recipientId: string) {
  // Check both directions for an existing edge
  const { data: existing } = await supabase
    .from("friend_requests")
    .select("id, sender_id, recipient_id, status")
    .or(
      `and(sender_id.eq.${senderId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${senderId})`
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted" || existing.status === "pending") return existing;
    // Reset declined/canceled: if it was from this sender, just flip; otherwise recreate
    if (existing.sender_id === senderId) {
      const { data, error } = await supabase
        .from("friend_requests")
        .update({ status: "pending" })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    await supabase.from("friend_requests").delete().eq("id", existing.id);
  }

  // Idempotent insert: unique index on (sender_id, recipient_id) protects against races
  const { data, error } = await supabase
    .from("friend_requests")
    .upsert(
      { sender_id: senderId, recipient_id: recipientId, status: "pending" },
      { onConflict: "sender_id,recipient_id", ignoreDuplicates: false }
    )
    .select()
    .single();
  if (error) {
    // Race fallback: re-fetch the row that won
    const { data: row } = await supabase
      .from("friend_requests")
      .select("id, sender_id, recipient_id, status")
      .or(
        `and(sender_id.eq.${senderId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${senderId})`
      )
      .maybeSingle();
    if (row) return row;
    throw error;
  }
  return data;
}

/** Notify in-app listeners (e.g. nav badge) to recount immediately, without
 *  waiting for the Postgres realtime round-trip. */
function emitFriendRequestsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("friend-requests:changed"));
  }
}

export async function respondToRequest(id: string, accept: boolean) {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", id);
  if (error) throw error;
  emitFriendRequestsChanged();
}

export async function cancelRequest(id: string) {
  const { error } = await supabase.from("friend_requests").delete().eq("id", id);
  if (error) throw error;
  emitFriendRequestsChanged();
}

/** Get or create a 1:1 conversation between two friends. Race-safe. */
export async function openConversation(meId: string, otherId: string) {
  const [a, b] = [meId, otherId].sort();
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_a: a, user_b: b })
    .select("id")
    .single();
  if (!error && data) return data.id as string;

  // Race: another tab/session created it — re-fetch
  const { data: again, error: againErr } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  if (againErr || !again) throw error ?? againErr;
  return again.id as string;
}

/** Open conversation and send the first message in one call. */
export async function startConversationWithMessage(
  meId: string,
  otherId: string,
  content: string,
  attachment?: File | null
) {
  const conversationId = await openConversation(meId, otherId);

  let body = content;
  if (attachment) {
    const { url, error } = await uploadPrivateFileForSignedUrl("resources", meId, attachment);
    if (error || !url) throw new Error(error || "Could not share file");
    body = body ? `${body}\n${url}` : url;
  }

  const { error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: meId, content: body });
  if (error) throw error;
  return conversationId;
}

