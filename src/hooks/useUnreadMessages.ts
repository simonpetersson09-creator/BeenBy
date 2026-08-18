import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getLastReadAt, onChatRead } from "@/lib/chatRead";

/** Number of chat messages from the siblings since the chat was last opened. */
export function useUnreadMessages(circleId: string | undefined, userId: string | undefined) {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!circleId || !userId) return;
    const { count: n } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("family_circle_id", circleId)
      .neq("user_id", userId)
      .gt("created_at", getLastReadAt(circleId));
    setCount(n ?? 0);
  }, [circleId, userId]);

  useEffect(() => {
    void load();
    const off = onChatRead(() => void load());
    return off;
  }, [load]);

  useEffect(() => {
    if (!circleId) return;
    const channel = supabase
      .channel(`unread-${circleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `family_circle_id=eq.${circleId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [circleId, load]);

  return count;
}
