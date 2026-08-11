import { Copy, Mail, MessageCircle, MessageSquare, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useT } from "@/lib/i18n";
import {
  copyText,
  mailtoUrl,
  openAppOrShare,
  openExternalUrl,
  shareLink,
  smsUrl,
  whatsappUrl,
} from "@/lib/share";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The family invitation code — the only thing we ever share. */
  code: string | null;
};

/**
 * Bottom sheet for sending the invitation. We never share a URL: BeenBy is
 * joined with the family code, so every option sends the same short message
 * containing that code.
 */
export function InviteSheet({ open, onOpenChange, code }: Props) {
  const t = useT();
  const text = code ? t("invite.codeMsg", { code }) : "";
  const sharePayload = { title: t("invite.subject"), text };

  /** System schemes (sms:/mailto:) are always handled by iOS — just open them. */
  function openSystem(href: string) {
    openExternalUrl(href);
    onOpenChange(false);
  }

  /** App links that may not resolve — fall back to the native share sheet. */
  async function openAppWithFallback(href: string) {
    if (!code) return;
    const result = await openAppOrShare(href, sharePayload);
    if (result === "copied") toast.success(t("invite.copied"));
    onOpenChange(false);
  }

  /** Messenger has no text-only share scheme, so use the native share sheet. */
  async function shareViaSheet() {
    if (!code) return;
    const result = await shareLink(sharePayload);
    if (result === "copied") toast.success(t("invite.copied"));
    onOpenChange(false);
  }

  const options = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: MessageCircle,
      tint: "bg-[#25D366]/15 text-[#128C4A]",
      onClick: () => void openAppWithFallback(whatsappUrl(text)),
    },
    {
      key: "messenger",
      label: "Messenger",
      icon: Share2,
      tint: "bg-[#0084FF]/15 text-[#0064C8]",
      onClick: () => void shareViaSheet(),
    },
    {
      key: "sms",
      label: "SMS",
      icon: MessageSquare,
      tint: "bg-primary/10 text-primary",
      onClick: () => openSystem(smsUrl(text)),
    },
    {
      key: "mail",
      label: t("invite.mail"),
      icon: Mail,
      tint: "bg-secondary text-primary",
      onClick: () => openSystem(mailtoUrl(t("invite.subject"), text)),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-primary/20 pb-8">
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl text-primary">{t("invite.title")}</SheetTitle>
          <SheetDescription>{t("invite.sub")}</SheetDescription>
        </SheetHeader>

        {code ? (
          <p className="mt-3 rounded-2xl bg-secondary/60 py-3 text-center text-2xl tracking-[0.3em] text-primary">
            {code}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-4 gap-3">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={o.onClick}
              disabled={!code}
              className="flex flex-col items-center gap-2 rounded-2xl p-2 transition active:scale-95 disabled:opacity-50"
            >
              <span className={`flex size-14 items-center justify-center rounded-2xl ${o.tint}`}>
                <o.icon className="size-6" />
              </span>
              <span className="text-[0.7rem] text-primary">{o.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!code}
            onClick={async () => {
              if (!code) return;
              await copyText(code);
              toast.success(t("invite.copied"));
              onOpenChange(false);
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-secondary text-sm text-primary disabled:opacity-50"
          >
            <Copy className="size-4" /> {t("invite.copy")}
          </button>
          <button
            type="button"
            disabled={!code}
            onClick={() => void shareViaSheet()}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-sm text-primary-foreground disabled:opacity-50"
          >
            <Share2 className="size-4" /> {t("invite.more")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
