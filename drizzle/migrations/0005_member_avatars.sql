ALTER TABLE public.family_members ADD COLUMN IF NOT EXISTS avatar_path text;

-- Path format: {circle_id}/{user_id}-{random}.enc  (encrypted with the circle key on device)
CREATE POLICY "circle members read avatars" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND public.is_circle_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "members upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars'
    AND public.is_circle_member(((storage.foldername(name))[1])::uuid)
    AND split_part(storage.filename(name), '-', 1) = replace(auth.uid()::text, '-', ''));
CREATE POLICY "members delete own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND split_part(storage.filename(name), '-', 1) = replace(auth.uid()::text, '-', ''));