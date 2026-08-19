ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No user access to push_log" ON public.push_log
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);