DROP POLICY IF EXISTS "members can upload chat images" ON storage.objects;
CREATE POLICY "members can upload chat images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-images' AND owner = auth.uid()
  AND public.is_circle_member(((storage.foldername(name))[1])::uuid)
  AND public.has_app_access(auth.uid())
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND array_length(storage.foldername(name), 1) = 2
  AND (lower(name) LIKE '%.enc' OR lower(name) LIKE '%.jpg')
  AND char_length(name) <= 300
  AND (metadata IS NULL OR (
    COALESCE((metadata->>'size')::bigint, 0) <= 5242880
    AND COALESCE(metadata->>'mimetype', 'image/jpeg') = ANY (ARRAY['image/jpeg','image/png','image/webp'])
  ))
);