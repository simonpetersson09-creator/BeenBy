CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_circle_id uuid NOT NULL REFERENCES public.family_circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read messages" ON public.messages
  FOR SELECT TO authenticated USING (public.is_circle_member(family_circle_id));

CREATE POLICY "insert own messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_circle_member(family_circle_id));

CREATE POLICY "delete own messages" ON public.messages
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX messages_circle_created_idx ON public.messages (family_circle_id, created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;