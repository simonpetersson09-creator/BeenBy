import { createFileRoute } from "@tanstack/react-router";

/**
 * Removes chat images that were uploaded but never attached to a sent message
 * (the user picked a photo and then closed the app). Protected by the same
 * shared secret as the push hook — intended for a scheduled call, not clients.
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/cleanup-chat-images")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env['PUSH_HOOK_SECRET'] ?? "";
        if (!secret || !timingSafeEqual(request.headers.get("x-push-secret") ?? "", secret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("orphan_chat_images", {
          _older_than_hours: 24,
          _limit: 500,
        });
        if (error) return new Response(`error: ${error.message}`, { status: 500 });

        const names = (data ?? []).map((row) => row.object_name).filter(Boolean) as string[];
        if (names.length === 0) return Response.json({ removed: 0 });

        const { error: removeError } = await supabaseAdmin.storage.from("chat-images").remove(names);
        if (removeError) return new Response(`error: ${removeError.message}`, { status: 500 });

        return Response.json({ removed: names.length });
      },
    },
  },
});
