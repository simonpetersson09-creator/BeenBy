import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, ImagePlus, Loader2, Lock, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Paywall } from "@/components/Paywall";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCircleData, type Member } from "@/hooks/useCircleData";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { markChatRead } from "@/lib/chatRead";
import { localeOf, useT, usePersonLabel } from "@/lib/i18n";
import { colorById } from "@/lib/palette";
import {
  compressToJpeg,
  isNativePhotoAvailable,
  pickNativePhoto,
  validateImage,
} from "@/lib/photo";
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
      { title: "Family chat – BeenBy" },
      {
        name: "description",
        content:
          "A small chat for the siblings: comment on a visit and agree on who goes next time.",
      },
      { property: "og:title", content: "Family chat – BeenBy" },
      {
        property: "og:description",
        content: "Leave a short note for your siblings about the visits – simple and calm.",
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
  const [pending, setPending] = useState<{ blob: Blob; url: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { hasAccess } = useAccess();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState(false);
  const locked = !hasAccess;

  useEffect(() => {
    const resetTransientUi = () => {
      setSending(false);
      setUploading(false);
      setPreparing(false);
      setSourceOpen(false);
      setPaywallOpen(false);
      setToDelete(null);
      setDeleting(false);
    };
    window.addEventListener("beenby:resume", resetTransientUi);
    return () => window.removeEventListener("beenby:resume", resetTransientUi);
  }, []);

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
  // Use the newest message's server timestamp so the badge never depends on
  // the device clock being in sync with the backend.
  const newestAt = messages.at(-1)?.created_at;
  useEffect(() => {
    if (!circleId) return;
    const mark = () => {
      if (document.visibilityState === "visible") markChatRead(circleId, newestAt);
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [circleId, newestAt]);

  // Signed URLs live for an hour – drop them a bit before that so the effect
  // below re-signs and images never turn into broken links in a long session.
  useEffect(() => {
    const id = window.setInterval(() => setImageUrls({}), 50 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

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
    try {
      const { error } = await supabase
        .from("messages")
        .insert({ family_circle_id: circleId, user_id: user.id, body });
      if (error) {
        toast.error(t("chat.sendError"));
        return;
      }
      setText("");
    } finally {
      setSending(false);
    }
    setText("");
  }

  /** Validate + compress, then show a preview instead of sending right away. */
  async function preparePhoto(input: Blob) {
    const problem = validateImage(input);
    if (problem) {
      toast.error(problem === "size" ? t("chat.photoTooLarge") : t("chat.photoType"));
      return;
    }
    setPreparing(true);
    try {
      const jpeg = await compressToJpeg(input);
      setPending((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { blob: jpeg, url: URL.createObjectURL(jpeg) };
      });
    } catch {
      toast.error(t("chat.imageError"));
    } finally {
      setPreparing(false);
    }
  }

  function discardPending() {
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }

  function openWebPicker(source: "camera" | "library") {
    if (!fileRef.current) return;
    if (source === "camera") fileRef.current.setAttribute("capture", "environment");
    else fileRef.current.removeAttribute("capture");
    fileRef.current.click();
  }

  async function choosePhoto(source: "camera" | "library") {
    setSourceOpen(false);
    if (locked) {
      setPaywallOpen(true);
      return;
    }
    if (isNativePhotoAvailable()) {
      const result = await pickNativePhoto(source);
      if (result.status === "ok") {
        void preparePhoto(result.blob);
        return;
      }
      if (result.status === "cancelled") return;
      if (result.status === "denied") {
        toast.error(t("chat.photoDenied"));
        return;
      }
      // Plugin missing or failed: let the web picker take over rather than
      // leaving the button looking dead.
      openWebPicker(source);
      return;
    }
    openWebPicker(source);

  }

  async function sendPending() {
    if (locked) {
      setPaywallOpen(true);
      return;
    }
    if (!pending || !circleId || !user) return;
    setUploading(true);
    try {
      const path = `${circleId}/${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("chat-images")
        .upload(path, pending.blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) {
        toast.error(t("chat.imageError"));
        return;
      }
      const { error } = await supabase.from("messages").insert({
        family_circle_id: circleId,
        user_id: user.id,
        body: text.trim().slice(0, 1000),
        image_path: path,
      });
      if (error) {
        void supabase.storage.from("chat-images").remove([path]);
        toast.error(t("chat.imageError"));
        return;
      }
      discardPending();
      setText("");
    } finally {
      setUploading(false);
    }
    discardPending();
    setText("");
  }


  async function removeMessage(m: Message) {
    setDeleting(true);
    try {
      const { error } = await supabase.from("messages").delete().eq("id", m.id);
      if (error) {
        toast.error(t("chat.deleteError"));
        return;
      }
      if (m.image_path) {
        void supabase.storage.from("chat-images").remove([m.image_path]);
      }
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
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
      <header className="sticky top-0 z-20 -mx-5 mb-4 flex items-center gap-2 border-b border-primary/10 bg-background/95 px-5 pb-3 pt-4 backdrop-blur">
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

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(o) => (o ? undefined : setToDelete(null))}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("chat.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("chat.deleteConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                if (toDelete) void removeMessage(toDelete);
              }}
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : t("chat.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                <div className="flex items-end gap-1">
                  {mine ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={t("chat.delete")}
                      onClick={() => setToDelete(m)}
                      className="size-8 shrink-0 rounded-xl text-muted-foreground"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
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
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-gradient-to-t from-background via-background to-transparent px-5 pb-8 pt-5">
        {pending ? (
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-primary/10 bg-card p-2 shadow-soft">
            <img
              src={pending.url}
              alt={t("chat.photoPreview")}
              className="size-16 rounded-xl object-cover"
            />
            <p className="flex-1 text-xs text-muted-foreground">{t("chat.photoPreview")}</p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("chat.discardPhoto")}
              onClick={discardPending}
              className="size-9 rounded-xl"
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : null}

        {sourceOpen ? (
          <div className="mb-3 grid gap-2 rounded-2xl border border-primary/10 bg-card p-2 shadow-soft">
            <Button
              type="button"
              variant="ghost"
              className="h-12 justify-start gap-3 rounded-xl"
              onClick={() => void choosePhoto("camera")}
            >
              <Camera className="size-5" />
              {t("chat.takePhoto")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-12 justify-start gap-3 rounded-xl"
              onClick={() => void choosePhoto("library")}
            >
              <ImagePlus className="size-5" />
              {t("chat.fromLibrary")}
            </Button>
          </div>
        ) : null}

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) void sendPending();
            else void send();
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
              if (file) void preparePhoto(file);
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label={t("chat.addPhoto")}
            disabled={uploading || preparing}
            onClick={() => (locked ? setPaywallOpen(true) : setSourceOpen((v) => !v))}
            className="size-12 shrink-0 rounded-2xl"
          >
            {uploading || preparing ? (
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
            aria-label={locked ? t("access.locked") : pending ? t("chat.sendPhoto") : t("chat.send")}
            disabled={sending || uploading || (!locked && !pending && text.trim().length === 0)}
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
