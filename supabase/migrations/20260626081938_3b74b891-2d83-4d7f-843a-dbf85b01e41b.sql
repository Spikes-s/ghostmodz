
CREATE POLICY "spikes uploads read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'spikes-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "spikes uploads insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'spikes-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "spikes uploads delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'spikes-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
