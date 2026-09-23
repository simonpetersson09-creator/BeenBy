/**
 * "Edit mode" for the onboarding flow.
 *
 * The home screen can send the user back through the same steps (who →
 * address → colour) to change what was entered when the circle was created.
 * The steps read their values from the onboarding draft, so entering edit
 * mode simply means filling the draft with the circle's real data, and the
 * last step saves the draft back to the database instead of creating a new
 * circle.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CircleData } from "@/hooks/useCircleData";
import { patchDraft } from "@/lib/onboardingDraft";

/** Fill the onboarding draft with the values currently stored for the circle. */
export function fillDraftFromCircle(data: CircleData, userId: string) {
  const { circle, person, members } = data;
  const me = members.find((m) => m.user_id === userId);
  const address = person?.address ?? "";
  patchDraft({
    personName: person?.name ?? circle.name,
    myName: me?.name ?? "",
    address,
    resolvedAddress: address || null,
    lat: person?.location_latitude ?? null,
    lng: person?.location_longitude ?? null,
    color: me?.personal_color ?? "blue",
    familyCode: circle.family_code,
  });
}

export type CircleEditValues = {
  personName: string;
  myName: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  color: string;
};

/** Write the edited values back to the circle, the person and the member row. */
export async function saveCircleEdit(userId: string, values: CircleEditValues) {
  const { data: membership, error: mErr } = await supabase
    .from("family_members")
    .select("id, family_circle_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!membership) throw new Error("no-circle");

  const circleId = membership.family_circle_id;
  const personName = values.personName.trim();
  const myName = values.myName.trim();

  const { error: cErr } = await supabase
    .from("family_circles")
    .update({ name: personName })
    .eq("id", circleId);
  if (cErr) throw cErr;

  const { data: person, error: pErr } = await supabase
    .from("persons")
    .select("id")
    .eq("family_circle_id", circleId)
    .limit(1)
    .maybeSingle();
  if (pErr) throw pErr;

  const personFields = {
    name: personName,
    address: values.address,
    location_latitude: values.lat,
    location_longitude: values.lng,
  };
  if (person) {
    const { error } = await supabase.from("persons").update(personFields).eq("id", person.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("persons")
      .insert({ family_circle_id: circleId, ...personFields });
    if (error) throw error;
  }

  const { error: memberErr } = await supabase
    .from("family_members")
    .update({ personal_color: values.color })
    .eq("id", membership.id);
  if (memberErr) throw memberErr;

  const { error: profErr } = await supabase.from("profiles").upsert({ id: userId, name: myName });
  if (profErr) throw profErr;
}

/** Colours used by the other members, so the picker can block them. */
export async function takenColors(userId: string): Promise<string[]> {
  const { data: membership } = await supabase
    .from("family_members")
    .select("family_circle_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) return [];
  const { data } = await supabase
    .from("family_members")
    .select("user_id, personal_color")
    .eq("family_circle_id", membership.family_circle_id);
  return (data ?? []).filter((m) => m.user_id !== userId).map((m) => m.personal_color);
}
