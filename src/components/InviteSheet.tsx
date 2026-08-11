import { Copy, Mail, MessageCircle, MessageSquare, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useT } from "@/lib/i18n";
import {
  copyText,
  mailtoUrl,
  messengerUrl,
  openAppOrShare,
  openExternalUrl,
  shareLink,
  smsUrl,
  whatsappUrl,
} from "@/lib/share";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  message: string;
};

/** Bottom sheet with the messaging apps people actually use to send an invite. */
export function InviteSheet({ open, onOpenChange, url, message }: Props) {
  const t = useT();
  const text = url ? `${message} ${url}` : message;

  const sharePayload = { title: t("invite.subject"), text: message, url: url ?? "" };

  /** Systems schemes (sms:/mailto:) are always handled by iOS — just open them. */
  function openSystem(href: string) {
    openExternalUrl(href);
    onOpenChange(false);
  }

  /** App links that may not resolve — fall back to the native share sheet. */
  async function openAppWithFallback(href: string) {
    if (!url) return;
    const result = await openAppOrShare(href, sharePayload);
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
      onClick: () => void openAppWithFallback(url ? messengerUrl(url) : "https://www.messenger.com/"),
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

        <div className="mt-4 grid grid-cols-4 gap-3">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={o.onClick}
              disabled={!url}
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
            disabled={!url}
            onClick={async () => {
              if (!url) return;
              await copyText(url);
              toast.success(t("invite.copied"));
              onOpenChange(false);
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-secondary text-sm text-primary disabled:opacity-50"
          >
            <Copy className="size-4" /> {t("invite.copy")}
          </button>
          <button
            type="button"
            disabled={!url}
            onClick={async () => {
              if (!url) return;
              const result = await shareLink(sharePayload);
              if (result === "copied") toast.success(t("invite.copied"));
              onOpenChange(false);
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-sm text-primary-foreground disabled:opacity-50"
          >
            <Share2 className="size-4" /> {t("invite.more")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
