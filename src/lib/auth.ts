import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

/**
 * Zero-friction identity: every user gets a real backend user_id without
 * ever seeing a registration form. The anonymous identity can later be
 * upgraded (linked) to Apple/Google without losing any data.
 */
let inFlight: Promise<User | null> | null = null;

export async function ensureUser(): Promise<User | null> {
  // Several components can mount at once (and React runs effects twice in
  // dev). Without this guard we would create a brand new anonymous user for
  // each call, which silently loses the family circle.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return data.session.user;

    const { data: anon, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error(error);
      return null;
    }
    return anon.user ?? null;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function isAnonymous(user: User | null): boolean {
  if (!user) return false;
  return user.is_anonymous === true || user.identities?.length === 0;
}
