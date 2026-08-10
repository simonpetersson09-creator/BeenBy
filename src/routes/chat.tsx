import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Lock, Send } from "lucide-react";
import { toast } from "sonner";

import { Paywall } from "@/components/Paywall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCircleData, type Member } from "@/hooks/useCircleData";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { localeOf, useT } from "@/lib/i18n";
import { colorById } from "@/lib/palette";
import { useAccess } from "@/lib/premiumStore";

type Message = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
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

function ChatPage() {
  const t = useT();
  const { user, loading } = useSession();
  const { data, isLoading } = useCircleData(user?.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
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
      .select("id, user_id, body, created_at")
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-6">
      <header className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label={t("common.back")} asChild>
          <Link to="/">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl leading-tight">{t("chat.title")}</h1>
          <p className="text-xs text-muted-foreground">
            {t("chat.about", { name: data.person?.name ?? data.circle.name })}
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
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div className="max-w-[80%]">
                <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                  {mine ? t("chat.you") : (member?.name ?? t("chat.someone"))} · {timeLabel(m.created_at, tz)}
                </p>
                <div
                  className={
                    mine
                      ? "rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-soft"
                      : "rounded-2xl bg-card px-4 py-2.5 text-sm text-foreground shadow-soft"
                  }
                >
                  {m.body}
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
