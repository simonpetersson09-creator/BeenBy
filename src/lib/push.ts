import { supabase } from "@/integrations/supabase/client";
import { getLang } from "@/lib/i18n";
import { isNativeRuntime } from "@/lib/native";

/**
 * Registers the device for real push notifications (iOS/APNs) and stores the
 * token so the backend can notify the rest of the family circle when someone
 * joins, writes in the chat or logs a visit.
 *
 * No-op in the web preview — push requires the installed app.
 */
export async function registerPushNotifications(): Promise<void> {
  if (!isNativeRuntime()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== "granted") return;

    await PushNotifications.removeAllListeners();
    await PushNotifications.addListener("registration", (token) => {
      void saveToken(token.value);
    });
    await PushNotifications.addListener("registrationError", (err) => {
      console.error("push registration failed", err);
    });
    // Tapping a chat notification opens the chat directly.
    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const type = (action.notification.data as Record<string, unknown> | undefined)?.["type"];
      if (type === "messages" && typeof window !== "undefined") {
        window.location.assign("/chat");
      }
    });

    await PushNotifications.register();
    // Clear any badge left from previous notifications.
    await PushNotifications.removeAllDeliveredNotifications();

  } catch (err) {
    console.error("push setup failed", err);
  }
}

async function saveToken(token: string) {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return;
  await supabase.from("device_tokens").upsert(
    {
      token,
      user_id: userId,
      platform: "ios",
      locale: safeLang(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
}

function safeLang(): string {
  try {
    return getLang();
  } catch {
    return "sv";
  }
}
