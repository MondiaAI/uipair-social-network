import { supabase } from "@/integrations/supabase/client";

export type UploadResult = { url: string | null; error?: string };

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
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
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
