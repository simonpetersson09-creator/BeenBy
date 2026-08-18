ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_path text;

DROP POLICY IF EXISTS "members can read chat images" ON storage.objects;
CREATE POLICY "members can read chat images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-images'
  AND public.is_circle_member(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "members can upload chat images" ON storage.objects;
CREATE POLICY "members can upload chat images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND public.is_circle_member(((storage.foldername(name))[1])::uuid)
  AND public.has_app_access(auth.uid())
  AND owner = auth.uid()
);

DROP POLICY IF EXISTS "members can delete own chat images" ON storage.objects;
CREATE POLICY "members can delete own chat images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-images' AND owner = auth.uid());