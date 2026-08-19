import { createFileRoute } from "@tanstack/react-router";

/**
 * APNs push fan-out. Called by database triggers (pg_net) whenever something
 * happens in a family circle: someone joins, writes in the chat, records a
 * visit or plans one. Sends a native notification to every OTHER member's
 * registered devices.
 */

type Payload = {
  table: string;
  record: Record<string, unknown>;
};

const TEXTS: Record<string, Record<string, { title: (n: string) => string; body?: string }>> = {
  sv: {
    family_members: { title: (n) => `${n} har gått med i familjen 🎉`, body: "Nu ser ni varandras besök direkt." },
    messages: { title: (n) => `${n} skrev i chatten` },
    visits: { title: (n) => `${n} har varit på besök` },
    planned_visits: { title: (n) => `${n} planerar ett besök` },
  },
  en: {
    family_members: { title: (n) => `${n} joined the family 🎉`, body: "You'll now see each other's visits right away." },
    messages: { title: (n) => `${n} wrote in the chat` },
    visits: { title: (n) => `${n} made a visit` },
    planned_visits: { title: (n) => `${n} planned a visit` },
  },
};

function textFor(locale: string, table: string, name: string) {
  const pack = TEXTS[locale] ?? TEXTS['en']!;
  const entry = pack[table] ?? TEXTS['en']![table];
  if (!entry) return null;
  return { title: entry.title(name), body: entry.body ?? "" };
}

function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function apnsToken(): Promise<string> {
  const keyId = process.env['APNS_KEY_ID']!;
  const teamId = process.env['APNS_TEAM_ID']!;
  const pem = process.env['APNS_PRIVATE_KEY']!.replace(/\\n/g, "\n");

  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  return `${header}.${claims}.${base64url(sig)}`;
}

export const Route = createFileRoute("/api/public/push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-push-secret") !== process.env['PUSH_HOOK_SECRET']) {
          return new Response("Unauthorized", { status: 401 });
        }

        const payload = (await request.json()) as Payload;
        const record = payload.record ?? {};
        const circleId = record['family_circle_id'] as string | undefined;
        const actorId = record['user_id'] as string | undefined;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const log = async (
          status: string,
          detail?: string,
          counts?: { recipients?: number; devices?: number },
        ) => {
          await supabaseAdmin.from("push_log").insert({
            source_table: payload.table ?? "unknown",
            status,
            detail: detail?.slice(0, 500) ?? null,
            recipients: counts?.recipients ?? 0,
            devices: counts?.devices ?? 0,
          });
        };

        if (!process.env['APNS_PRIVATE_KEY'] || !process.env['APNS_KEY_ID'] || !process.env['APNS_TEAM_ID']) {
          await log("not_configured", "APNs-nycklar saknas");
          return new Response("Push not configured", { status: 200 });
        }
        if (!circleId || !actorId) {
          await log("ignored", "saknar family_circle_id eller user_id");
          return new Response("ignored", { status: 200 });
        }

        const [{ data: members }, { data: profile }] = await Promise.all([
          supabaseAdmin.from("family_members").select("user_id").eq("family_circle_id", circleId),
          supabaseAdmin.from("profiles").select("name").eq("id", actorId).maybeSingle(),
        ]);

        const recipients = (members ?? [])
          .map((m) => m.user_id)
          .filter((id) => id !== actorId);
        if (recipients.length === 0) {
          await log("no_recipients", undefined, { recipients: 0 });
          return new Response("no recipients", { status: 200 });
        }

        const { data: devices } = await supabaseAdmin
          .from("device_tokens")
          .select("token, locale")
          .in("user_id", recipients);
        if (!devices || devices.length === 0) {
          await log("no_devices", "inga registrerade enheter", { recipients: recipients.length });
          return new Response("no devices", { status: 200 });
        }

        const name = profile?.name?.trim() || "Någon";
        let jwt: string;
        try {
          jwt = await apnsToken();
        } catch (err) {
          await log("jwt_error", String(err), { recipients: recipients.length, devices: devices.length });
          return new Response("jwt error", { status: 200 });
        }
        const host =
          process.env['APNS_ENV'] === "production"
            ? "https://api.push.apple.com"
            : "https://api.sandbox.push.apple.com";
        const topic = process.env['APNS_BUNDLE_ID'] ?? "app.beenbys.mobile";

        const failures: string[] = [];
        let sent = 0;

        await Promise.all(
          devices.map(async (device) => {
            const text = textFor(device.locale ?? "sv", payload.table, name);
            if (!text) return;
            try {
              const res = await fetch(`${host}/3/device/${device.token}`, {
                method: "POST",
                headers: {
                  authorization: `bearer ${jwt}`,
                  "apns-topic": topic,
                  "apns-push-type": "alert",
                  "apns-priority": "10",
                  "content-type": "application/json",
                },
                body: JSON.stringify({
                  aps: {
                    alert: { title: text.title, body: text.body },
                    sound: "default",
                    badge: 1,
                  },
                  type: payload.table,
                }),
              });
              if (res.ok) {
                sent += 1;
                return;
              }
              const body = await res.text();
              failures.push(`${res.status}:${body}`);
              // Apple returns 410 for tokens that are no longer valid.
              if (res.status === 410 || (res.status === 400 && body.includes("BadDeviceToken"))) {
                await supabaseAdmin.from("device_tokens").delete().eq("token", device.token);
              }
            } catch (err) {
              failures.push(String(err));
            }
          }),
        );

        await log(failures.length === 0 ? "sent" : sent > 0 ? "partial" : "failed", failures.join(" | ") || undefined, {
          recipients: recipients.length,
          devices: devices.length,
        });

        return new Response("ok");
      },

    },
  },
});
