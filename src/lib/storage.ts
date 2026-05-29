import { supabase } from "@/integrations/supabase/client";

export type UploadResult = { url: string | null; error?: string };

function safeStorageName(file: File) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

export async function uploadToBucket(
  bucket: string,
  userId: string,
  file: File,
): Promise<string | null> {
  const res = await uploadToBucketDetailed(bucket, userId, file);
  return res.url;
}

export async function uploadToBucketDetailed(
  bucket: string,
  userId: string,
  file: File,
): Promise<UploadResult> {
  try {
    if (!file) return { url: null, error: "No file selected" };
    // Hard cap to keep avatar/cover uploads fast and within bucket defaults.
    const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
    if (file.size > MAX_BYTES) {
      return { url: null, error: `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please choose one under 8 MB.` };
    }
    const path = `${userId}/${safeStorageName(file)}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
      cacheControl: "3600",
    });
    if (error) {
      console.error("[uploadToBucket] error", { bucket, path, error });
      return { url: null, error: error.message || "Upload failed" };
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl };
  } catch (e: any) {
    console.error("[uploadToBucket] exception", e);
    return { url: null, error: e?.message || "Upload failed" };
  }
}

export async function uploadPrivateFileForSignedUrl(
  bucket: string,
  userId: string,
  file: File,
  expiresIn = 60 * 60 * 24 * 7,
): Promise<UploadResult> {
  try {
    if (!file) return { url: null, error: "No file selected" };
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return { url: null, error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please choose one under 10 MB.` };
    }
    const path = `${userId}/${safeStorageName(file)}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
      cacheControl: "3600",
    });
    if (error) return { url: null, error: error.message || "Upload failed" };
    const { data, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (signedError) return { url: null, error: signedError.message || "Could not share file" };
    return { url: data?.signedUrl ?? null };
  } catch (e: any) {
    return { url: null, error: e?.message || "Upload failed" };
  }
}
