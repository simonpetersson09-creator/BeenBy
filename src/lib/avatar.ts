import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { decryptBlob, encryptBlob, ENCRYPTED_IMAGE_EXT, getCircleKey } from "@/lib/e2ee";
import { compressToJpeg, validateImage } from "@/lib/photo";

type AvatarMember = { user_id: string; avatar_path?: string | null };

/**
 * Profile photos are encrypted on the phone with the family key, like chat
 * photos, so nobody outside the circle (including us) can see them.
 */
export async function uploadAvatar(
  circleId: string,
  userId: string,
  file: Blob,
  oldPath: string | null,
): Promise<{ error: string | null; path?: string }> {
  const invalid = validateImage(file);
  if (invalid) return { error: invalid };
  const key = await getCircleKey(circleId, userId).catch(() => null);
  if (!key) return { error: "no_key" };
  const jpeg = await compressToJpeg(file);
  const sealed = await encryptBlob(key, jpeg);
  const path = `${circleId}/${userId.replace(/-/g, "")}-${crypto.randomUUID()}${ENCRYPTED_IMAGE_EXT}`;
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, sealed, { contentType: "application/octet-stream", upsert: false });
  if (upErr) return { error: upErr.message };
  const { error } = await supabase
    .from("family_members")
    .update({ avatar_path: path })
    .eq("family_circle_id", circleId)
    .eq("user_id", userId);
  if (error) {
    void supabase.storage.from("avatars").remove([path]);
    return { error: error.message };
  }
  if (oldPath) void supabase.storage.from("avatars").remove([oldPath]);
  return { error: null, path };
}

export async function removeAvatar(circleId: string, userId: string, oldPath: string | null) {
  await supabase
    .from("family_members")
    .update({ avatar_path: null })
    .eq("family_circle_id", circleId)
    .eq("user_id", userId);
  if (oldPath) await supabase.storage.from("avatars").remove([oldPath]);
}

const cache = new Map<string, string>();

/** Map user_id → local object URL of the decrypted photo. */
export function useAvatarUrls(
  circleId: string | undefined,
  userId: string | undefined,
  members: AvatarMember[] | undefined,
): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const sig = (members ?? []).map((m) => `${m.user_id}:${m.avatar_path ?? ""}`).join(",");

  useEffect(() => {
    if (!circleId || !userId || !members) return;
    let active = true;
    void (async () => {
      const withPath = members.filter((m) => m.avatar_path);
      const next: Record<string, string> = {};
      const missing: AvatarMember[] = [];
      for (const m of withPath) {
        const hit = cache.get(m.avatar_path!);
        if (hit) next[m.user_id] = hit;
        else missing.push(m);
      }
      if (missing.length > 0) {
        const key = await getCircleKey(circleId, userId).catch(() => null);
        if (key) {
          const { data: signed } = await supabase.storage
            .from("avatars")
            .createSignedUrls(missing.map((m) => m.avatar_path!), 600);
          for (const m of missing) {
            const s = signed?.find((x) => x.path === m.avatar_path);
            if (!s?.signedUrl) continue;
            try {
              const blob = await decryptBlob(key, await (await fetch(s.signedUrl)).arrayBuffer());
              if (!blob) continue;
              const url = URL.createObjectURL(blob);
              cache.set(m.avatar_path!, url);
              next[m.user_id] = url;
            } catch {
              // Show the initial instead.
            }
          }
        }
      }
      if (active) setUrls(next);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId, userId, sig]);

  return urls;
}
