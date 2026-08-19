import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { addDays, todayKey } from "@/lib/dates";

export type Circle = {
  id: string;
  name: string;
  timezone: string;
  family_code: string;
  created_by: string;
};

export type Person = {
  id: string;
  name: string;
  address: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  geofence_radius: number;
};

export type Member = {
  id: string;
  user_id: string;
  personal_color: string;
  role: string;
  name: string;
};

export type Visit = {
  id: string;
  user_id: string;
  person_id: string;
  visited_at: string;
  local_day: string;
  source: string;
  activities: string[] | null;
  activity_note: string | null;
};

export type PlannedVisit = {
  id: string;
  user_id: string;
  person_id: string;
  planned_date: string;
  status: string;
  activities: string[] | null;
  activity_note: string | null;
};

export type CircleData = {
  circle: Circle;
  person: Person | null;
  members: Member[];
  visits: Visit[];
  planned: PlannedVisit[];
};

async function loadCircle(userId: string): Promise<CircleData | null> {
  const { data: membership, error: mErr } = await supabase
    .from("family_members")
    .select("family_circle_id, joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!membership) return null;

  const circleId = membership.family_circle_id;

  const { data: circle, error: cErr } = await supabase
    .from("family_circles")
    .select("id, name, timezone, family_code, created_by")
    .eq("id", circleId)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!circle) return null;

  const since = addDays(todayKey(circle.timezone), -60);

  const [persons, members, names, visits, planned] = await Promise.all([
    supabase
      .from("persons")
      .select("id, name, address, location_latitude, location_longitude, geofence_radius")
      .eq("family_circle_id", circleId)
      .order("created_at", { ascending: true }),
    supabase
      .from("family_members")
      .select("id, user_id, personal_color, role")
      .eq("family_circle_id", circleId)
      .order("joined_at", { ascending: true }),
    supabase.rpc("circle_member_names", { _circle: circleId }),
    supabase
      .from("visits")
      .select("id, user_id, person_id, visited_at, local_day, source, activities, activity_note")
      .eq("family_circle_id", circleId)
      .gte("local_day", since),
    supabase
      .from("planned_visits")
      .select("id, user_id, person_id, planned_date, status, activities, activity_note")
      .eq("family_circle_id", circleId)
      .eq("status", "planned")
      .gte("planned_date", since),
  ]);

  const nameMap = new Map<string, string>(
    ((names.data ?? []) as { user_id: string; name: string }[]).map((n) => [n.user_id, n.name]),
  );

  return {
    circle: circle as Circle,
    person: (persons.data?.[0] as Person | undefined) ?? null,
    members: ((members.data ?? []) as Omit<Member, "name">[]).map((m) => ({
      ...m,
      name: nameMap.get(m.user_id) || "Familjemedlem",
    })),
    visits: (visits.data ?? []) as Visit[],
    planned: (planned.data ?? []) as PlannedVisit[],
  };
}

export function useCircleData(userId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["circle", userId],
    queryFn: () => loadCircle(userId!),
    enabled: Boolean(userId),
  });

  const circleId = query.data?.circle.id;

  // Realtime: every family member's app updates without a reload.
  useEffect(() => {
    if (!circleId) return;
    const channel = supabase
      .channel(`circle-${circleId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visits", filter: `family_circle_id=eq.${circleId}` },
        () => queryClient.invalidateQueries({ queryKey: ["circle"] }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "planned_visits",
          filter: `family_circle_id=eq.${circleId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["circle"] }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_members",
          filter: `family_circle_id=eq.${circleId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["circle"] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [circleId, queryClient]);

  return query;
}
