// End-to-end encryption helpers for chat.
// Per-device keypair: private key kept in localStorage, public key published to profiles.public_key.
// Message wire format (stored in messages.content):
//   e2ee:v1:<senderPubB64>:<nonceB64>:<cipherB64>
// Decryption requires this device's secretKey + sender's public key.
// Anything that doesn't parse / decrypt is shown via a safe fallback in the UI.

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_PREFIX = "uipair.e2ee.sk.v1.";
const PREFIX = "e2ee:v1:";

export type KeyPair = { publicKey: Uint8Array; secretKey: Uint8Array };

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadLocalKeypair(userId: string): KeyPair | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const secretKey = naclUtil.decodeBase64(raw);
    if (secretKey.length !== nacl.box.secretKeyLength) return null;
    const { publicKey } = nacl.box.keyPair.fromSecretKey(secretKey);
    return { publicKey, secretKey };
  } catch {
    return null;
  }
}

function saveLocalKeypair(userId: string, kp: KeyPair) {
  localStorage.setItem(storageKey(userId), naclUtil.encodeBase64(kp.secretKey));
}

/**
 * Make sure this device has a keypair AND that the public key in profiles
 * matches it. If a key exists locally we keep it; otherwise generate one.
 * Returns the local keypair, or null on SSR.
 */
export async function ensureDeviceKeypair(userId: string): Promise<KeyPair | null> {
  if (typeof window === "undefined") return null;
  let kp = loadLocalKeypair(userId);
  if (!kp) {
    const generated = nacl.box.keyPair();
    kp = { publicKey: generated.publicKey, secretKey: generated.secretKey };
    saveLocalKeypair(userId, kp);
  }
  const pubB64 = naclUtil.encodeBase64(kp.publicKey);
  // Publish (or refresh) public key on profile so the other side can encrypt to us.
  const { data } = await supabase.from("profiles").select("public_key").eq("id", userId).maybeSingle();
  if (data?.public_key !== pubB64) {
    await supabase.from("profiles").update({ public_key: pubB64 }).eq("id", userId);
  }
  return kp;
}

export async function fetchPublicKey(userId: string): Promise<Uint8Array | null> {
  const { data } = await supabase.from("profiles").select("public_key").eq("id", userId).maybeSingle();
  if (!data?.public_key) return null;
  try {
    const pk = naclUtil.decodeBase64(data.public_key);
    if (pk.length !== nacl.box.publicKeyLength) return null;
    return pk;
  } catch {
    return null;
  }
}

export function encryptMessage(plaintext: string, recipientPub: Uint8Array, sender: KeyPair): string {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const cipher = nacl.box(naclUtil.decodeUTF8(plaintext), nonce, recipientPub, sender.secretKey);
  return [
    PREFIX.slice(0, -1), // "e2ee:v1"
    naclUtil.encodeBase64(sender.publicKey),
    naclUtil.encodeBase64(nonce),
    naclUtil.encodeBase64(cipher),
  ].join(":");
}

export type DecryptResult =
  | { ok: true; plaintext: string }
  | { ok: false; reason: "legacy" | "no_key" | "failed" };

export function isEncrypted(content: string): boolean {
  return typeof content === "string" && content.startsWith(PREFIX);
}

/**
 * Decrypt a stored message. We try with the receiver's secret key against the
 * sender's embedded public key. For messages we sent ourselves, pass our own
 * keypair as `me` and the recipient's public key as `counterpart`.
 */
export function decryptMessage(
  content: string,
  me: KeyPair | null,
  counterpartPub: Uint8Array | null
): DecryptResult {
  if (!isEncrypted(content)) return { ok: false, reason: "legacy" };
  if (!me) return { ok: false, reason: "no_key" };
  const parts = content.split(":");
  // ["e2ee","v1", senderPub, nonce, cipher]
  if (parts.length !== 5) return { ok: false, reason: "failed" };
  try {
    const senderPub = naclUtil.decodeBase64(parts[2]);
    const nonce = naclUtil.decodeBase64(parts[3]);
    const cipher = naclUtil.decodeBase64(parts[4]);
    // If senderPub matches our own public key, this is a message we sent —
    // decrypt against the counterpart's public key instead.
    const mePubB64 = naclUtil.encodeBase64(me.publicKey);
    const otherPub =
      parts[2] === mePubB64 ? counterpartPub : senderPub;
    if (!otherPub) return { ok: false, reason: "no_key" };
    const opened = nacl.box.open(cipher, nonce, otherPub, me.secretKey);
    if (!opened) return { ok: false, reason: "failed" };
    return { ok: true, plaintext: naclUtil.encodeUTF8(opened) };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export function fallbackLabel(reason: "legacy" | "no_key" | "failed"): string {
  if (reason === "legacy") return "🔓 Unencrypted message (legacy)";
  if (reason === "no_key") return "🔒 Encrypted — no key on this device";
  return "🔒 Encrypted message (cannot decrypt)";
}
