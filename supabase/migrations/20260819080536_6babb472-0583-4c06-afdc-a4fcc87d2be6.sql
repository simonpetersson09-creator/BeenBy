-- push_log is internal: only the notify_push trigger (running as the function
-- owner) writes to it, and only service_role should read it. Re-enable RLS
-- and add a restrictive policy so authenticated users cannot access it.
ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No user access to push_log" ON public.push_log
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
