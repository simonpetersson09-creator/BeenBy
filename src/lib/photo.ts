/**
 * Photo picking + compression for the family chat.
 *
 * Native (Capacitor/WKWebView): uses @capacitor/camera so the user gets the
 * real iOS camera or photo library. Web: falls back to a hidden file input.
 *
 * Everything is normalised to JPEG before upload — that keeps HEIC photos from
 * iPhones out of the storage bucket (WKWebView and other browsers can't always
 * render them) and keeps uploads small on poor connections.
 */

import { isNativeRuntime } from "@/lib/native";

export type PhotoSource = "camera" | "library";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB before compression
export const MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 0.8;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"];

export function isNativePhotoAvailable(): boolean {
  return isNativeRuntime();
}

export type NativePickResult =
  | { status: "ok"; blob: Blob }
  | { status: "cancelled" }
  | { status: "denied" }
  | { status: "unavailable"; detail: string };

function messageOf(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
}

/**
 * Picks a photo natively. Distinguishes cancel, denied permission and a
 * missing/unregistered plugin so the caller can fall back or explain instead of
 * doing nothing at all.
 */
export async function pickNativePhoto(source: PhotoSource): Promise<NativePickResult> {
  let Camera: typeof import("@capacitor/camera").Camera;
  let CameraResultType: typeof import("@capacitor/camera").CameraResultType;
  let CameraSource: typeof import("@capacitor/camera").CameraSource;
  try {
    ({ Camera, CameraResultType, CameraSource } = await import("@capacitor/camera"));
  } catch (error) {
    return { status: "unavailable", detail: messageOf(error) };
  }

  // Ask up front; on iOS a missing Info.plist usage string surfaces here.
  try {
    const current = await Camera.checkPermissions();
    const needed = source === "camera" ? current.camera : current.photos;
    if (needed !== "granted" && needed !== "limited") {
      const asked = await Camera.requestPermissions({
        permissions: [source === "camera" ? "camera" : "photos"],
      });
      const after = source === "camera" ? asked.camera : asked.photos;
      if (after === "denied") return { status: "denied" };
    }
  } catch {
    // checkPermissions is not implemented on every platform — keep going.
  }

  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      correctOrientation: true,
      resultType: CameraResultType.Uri,
      source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
      presentationStyle: "fullscreen",
    });
    const path = photo.webPath ?? photo.path;
    if (!path) return { status: "cancelled" };
    const res = await fetch(path);
    return { status: "ok", blob: await res.blob() };
  } catch (error) {
    const msg = messageOf(error).toLowerCase();
    if (msg.includes("cancel")) return { status: "cancelled" };
    if (msg.includes("denied") || msg.includes("permission") || msg.includes("access")) {
      return { status: "denied" };
    }
    if (msg.includes("not implemented") || msg.includes("unavailable") || msg.includes("not available")) {
      return { status: "unavailable", detail: msg };
    }
    return { status: "unavailable", detail: msg };
  }
}


/** Basic guard so we never try to upload a video or a 50 MB raw file. */
export function validateImage(file: Blob & { name?: string }): string | null {
  const type = file.type || "";
  if (type && !ALLOWED_TYPES.includes(type.toLowerCase())) return "type";
  if (file.size > MAX_UPLOAD_BYTES) return "size";
  return null;
}

/**
 * Downscales to at most MAX_DIMENSION on the longest side and re-encodes as
 * JPEG. If the browser can't decode the source (rare HEIC case) we throw so the
 * caller can show a friendly message instead of uploading something unusable.
 */
export async function compressToJpeg(input: Blob): Promise<Blob> {
  const bitmap = await loadBitmap(input);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas");
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("encode-failed");
  return blob;
}

type Decoded = { width: number; height: number; close?: () => void };

async function loadBitmap(input: Blob): Promise<Decoded & CanvasImageSource> {
  if (typeof createImageBitmap === "function") {
    try {
      return (await createImageBitmap(input)) as ImageBitmap;
    } catch {
      // fall through to <img>, which handles HEIC on iOS
    }
  }
  const url = URL.createObjectURL(input);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode-failed"));
      img.src = url;
    });
    return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
  } finally {
    // Revoke after the browser has decoded into the canvas on next tick.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
