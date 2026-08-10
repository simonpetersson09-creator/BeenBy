import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";

/**
 * In-app notifications for the family circle:
 * - a sibling sends a chat message
 * - a sibling joins the family with the code / invite link
 *
 * Own events are ignored, so you never get a notification about yourself.
 */
export function useFamilyNotifications({
  circleId,
  userId,
  enabled = true,
  onEvent,
}: {
  circleId: string | undefined;
  userId: string | undefined;
  enabled?: boolean;
  onEvent?: () => void;
}) {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!circleId || !userId || !enabled) return;
    let active = true;

    const nameOf = async (id: string): Promise<string> => {
      const { data } = await supabase.rpc("circle_member_names", { _circle: circleId });
      const rows = (data ?? []) as { user_id: string; name: string }[];
      const found = rows.find((r) => r.user_id === id);
      return found?.name?.trim() || tRef.current("chat.someone");
    };

    const channel = supabase
      .channel(`notify-${circleId}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `family_circle_id=eq.${circleId}`,
        },
        (payload) => {
          const row = payload.new as { user_id: string; body: string };
          if (row.user_id === userId) return;
          void nameOf(row.user_id).then((name) => {
            if (!active) return;
            toast(tRef.current("notify.message", { name }), { description: row.body });
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "family_members",
          filter: `family_circle_id=eq.${circleId}`,
        },
        (payload) => {
          const row = payload.new as { user_id: string };
          if (row.user_id === userId) return;
          void nameOf(row.user_id).then((name) => {
            if (!active) return;
            toast.success(tRef.current("notify.joined", { name }), {
              description: tRef.current("notify.joinedDesc"),
            });
            onEventRef.current?.();
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [circleId, userId, enabled]);
}
