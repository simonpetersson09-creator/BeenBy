import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

/**
 * Zero-friction identity: every user gets a real backend user_id without
 * ever seeing a registration form. The anonymous identity can later be
 * upgraded (linked) to Apple/Google without losing any data.
 */
export async function ensureUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user;

  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error(error);
    return null;
  }
  return anon.user ?? null;
}

export function isAnonymous(user: User | null): boolean {
  if (!user) return false;
  return user.is_anonymous === true || user.identities?.length === 0;
}
