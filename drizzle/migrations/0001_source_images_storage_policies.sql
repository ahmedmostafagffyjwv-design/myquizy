-- private bucket 'source-images': owner-folder access
CREATE POLICY "own folder upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'source-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own folder read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'source-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own folder delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'source-images' AND auth.uid()::text = (storage.foldername(name))[1]);