import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ImagePlus, Loader2, Lock, Send } from "lucide-react";
import { toast } from "sonner";

import { Paywall } from "@/components/Paywall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCircleData, type Member } from "@/hooks/useCircleData";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { markChatRead } from "@/lib/chatRead";
import { localeOf, useT, usePersonLabel } from "@/lib/i18n";
import { colorById } from "@/lib/palette";
import { useAccess } from "@/lib/premiumStore";

type Message = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  image_path: string | null;
};

export const Route = createFileRoute("/chat")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Familjechatten – Nära" },
      {
        name: "description",
        content:
          "En liten chatt för syskonen: skriv en kommentar om besöket, stäm av vem som åker nästa gång.",
      },
      { property: "og:title", content: "Familjechatten – Nära" },
      {
        property: "og:description",
        content: "Skriv en kort kommentar till syskonen om besöken – enkelt och lugnt.",
      },
    ],
  }),
  component: ChatPage,
});

function timeLabel(iso: string, tz: string) {
  return new Intl.DateTimeFormat(localeOf(), {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    timeZone: tz,
  }).format(new Date(iso));
}

/** Readable text color on a member color. */
function isDark(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.62;
}

function ChatPage() {
  const t = useT();
  const pl = usePersonLabel();
  const { user, loading } = useSession();
  const { data, isLoading } = useCircleData(user?.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { hasAccess } = useAccess();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const locked = !hasAccess;

  const circleId = data?.circle.id;

  useEffect(() => {
    if (!circleId) return;
    let active = true;

    void supabase
      .from("messages")
      .select("id, user_id, body, created_at, image_path")
      .eq("family_circle_id", circleId)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data: rows }) => {
        if (active && rows) setMessages(rows as Message[]);
      });

    const channel = supabase
      .channel(`messages-${circleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `family_circle_id=eq.${circleId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Message;
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          }
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setMessages((prev) => prev.filter((m) => m.id !== old.id));
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [circleId]);

  // Everything visible here counts as read — but only while the app is
  // actually in the foreground, so background updates don't clear the badge.
  useEffect(() => {
    if (!circleId) return;
    const mark = () => {
      if (document.visibilityState === "visible") markChatRead(circleId);
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [circleId, messages.length]);

  // Images live in a private bucket – sign the ones we need.
  useEffect(() => {
    const missing = messages
      .map((m) => m.image_path)
      .filter((p): p is string => Boolean(p) && !imageUrls[p!]);
    if (missing.length === 0) return;
    let active = true;
    void supabase.storage
      .from("chat-images")
      .createSignedUrls(missing, 60 * 60)
      .then(({ data: signed }) => {
        if (!active || !signed) return;
        setImageUrls((prev) => {
          const next = { ...prev };
          signed.forEach((s) => {
            if (s.path && s.signedUrl) next[s.path] = s.signedUrl;
          });
          return next;
        });
      });
    return () => {
      active = false;
    };
  }, [messages, imageUrls]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (locked) {
      setPaywallOpen(true);
      return;
    }
    const body = text.trim();
    if (!body || !circleId || !user) return;
    setSending(true);
    const { error } = await supabase
      .from("messages")
      .insert({ family_circle_id: circleId, user_id: user.id, body });
    setSending(false);
    if (error) {
      toast.error(t("chat.sendError"));
      return;
    }
    setText("");
  }

  async function sendImage(file: File) {
    if (locked) {
      setPaywallOpen(true);
      return;
    }
    if (!circleId || !user) return;
    setUploading(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${circleId}/${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("chat-images")
      .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
    if (upErr) {
      setUploading(false);
      toast.error(t("chat.imageError"));
      return;
    }
    const { error } = await supabase.from("messages").insert({
      family_circle_id: circleId,
      user_id: user.id,
      body: text.trim(),
      image_path: path,
    });
    setUploading(false);
    if (error) {
      toast.error(t("chat.imageError"));
      return;
    }
    setText("");
  }

  if (loading || isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || !user) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl">{t("chat.noCircle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("chat.noCircleDesc")}
        </p>
        <Button asChild className="h-12 rounded-2xl">
          <Link to="/">{t("chat.toStart")}</Link>
        </Button>
      </main>
    );
  }

  const memberOf = (id: string): Member | undefined =>
    data.members.find((m) => m.user_id === id);
  const tz = data.circle.timezone;

  return (
    <main className="app-scroll mx-auto flex h-dvh w-full max-w-md flex-col px-5">
      {/* Sticky so the title and back button follow along while scrolling. */}
      <header className="sticky top-0 z-20 -mx-5 mb-4 flex items-center gap-2 border-b border-primary/10 bg-background/95 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <Button variant="ghost" size="icon" aria-label={t("common.back")} asChild>
          <Link to="/">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl leading-tight">{t("chat.title")}</h1>
          <p className="text-xs text-muted-foreground">
            {t("chat.about", { name: pl(data.person?.name) || data.circle.name })}
          </p>
        </div>
      </header>

      <Paywall open={paywallOpen} onOpenChange={setPaywallOpen} />

      <div className="flex-1 space-y-3 pb-32">
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-xs text-muted-foreground">
            {t("chat.empty")}
          </p>
        ) : null}

        {messages.map((m) => {
          const mine = m.user_id === user.id;
          const member = memberOf(m.user_id);
          const color = colorById(member?.personal_color).hex;
          const dark = isDark(color);
          const url = m.image_path ? imageUrls[m.image_path] : undefined;
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div className="max-w-[80%]">
                <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                  {mine ? t("chat.you") : (member?.name ?? t("chat.someone"))} · {timeLabel(m.created_at, tz)}
                </p>
                <div
                  className="overflow-hidden rounded-2xl shadow-soft"
                  style={{
                    backgroundColor: dark ? color : `${color}26`,
                    color: dark ? "#ffffff" : undefined,
                    border: dark ? undefined : `1px solid ${color}66`,
                  }}
                >
                  {m.image_path ? (
                    url ? (
                      <img
                        src={url}
                        alt={t("chat.photoAlt")}
                        loading="lazy"
                        className="max-h-72 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-40 w-56 items-center justify-center">
                        <Loader2 className="size-4 animate-spin opacity-60" />
                      </div>
                    )
                  ) : null}
                  {m.body ? <p className="px-4 py-2.5 text-sm">{m.body}</p> : null}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md bg-gradient-to-t from-background via-background to-transparent px-5 pb-8 pt-5">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void sendImage(file);
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label={t("chat.addPhoto")}
            disabled={uploading}
            onClick={() => (locked ? setPaywallOpen(true) : fileRef.current?.click())}
            className="size-12 shrink-0 rounded-2xl"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
          </Button>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => (locked ? setPaywallOpen(true) : undefined)}
            placeholder={t("chat.placeholder")}
            maxLength={500}
            className="h-12 flex-1 rounded-2xl bg-card text-base"
          />
          <Button
            type="submit"
            size="icon"
            aria-label={locked ? t("access.locked") : t("chat.send")}
            disabled={sending || (!locked && text.trim().length === 0)}
            className="size-12 shrink-0 rounded-2xl"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : locked ? (
              <Lock className="size-4" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      </div>
    </main>
  );
}
