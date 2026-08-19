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
const PUSH_PREF_KEY = "beenby.push.enabled";
const PUSH_TOKEN_KEY = "beenby.push.token";

/** User preference for push notifications (defaults to on). */
export function isPushEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(PUSH_PREF_KEY) !== "off";
}

export async function setPushEnabled(next: boolean): Promise<void> {
  try {
    localStorage.setItem(PUSH_PREF_KEY, next ? "on" : "off");
  } catch {
    /* ignore */
  }
  if (next) {
    await registerPushNotifications();
  } else {
    await unregisterPushNotifications();
  }
}

function rememberToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(PUSH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(PUSH_TOKEN_KEY);
    }
  } catch {
    /* ignore */
  }
}

function recalledToken(): string | null {
  try {
    return localStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Removes this device's token so the backend stops sending push here. */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    const token = recalledToken();
    if (token) {
      await supabase.from("device_tokens").delete().eq("token", token);
    } else {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (userId) {
        await supabase.from("device_tokens").delete().eq("user_id", userId);
      }
    }
    rememberToken(null);
    if (isNativeRuntime()) {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      await PushNotifications.removeAllListeners();
      await PushNotifications.removeAllDeliveredNotifications();
    }
  } catch (err) {
    console.error("push unregister failed", err);
  }
}

export async function registerPushNotifications(): Promise<void> {
  if (!isNativeRuntime()) return;
  if (!isPushEnabled()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== "granted") return;

    await PushNotifications.removeAllListeners();
    await PushNotifications.addListener("registration", (token) => {
      rememberToken(token.value);
      void saveToken(token.value);
    });
    await PushNotifications.addListener("registrationError", (err) => {
      console.error("push registration failed", err);
    });
    // Tapping a notification navigates to the right screen.
    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const data = (action.notification.data as Record<string, unknown> | undefined) ?? {};
      const type = data["type"];
      if (typeof window === "undefined") return;
      if (type === "messages") {
        window.location.assign("/chat");
      } else {
        // visits, planned_visits and family_members all belong on the home screen.
        window.location.assign("/");
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
    return "en";
  }
}
