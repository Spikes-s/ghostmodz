-- Downloader settings: no longer world-readable. Public-safe fields are served by a server function.
DROP POLICY IF EXISTS "settings readable" ON public.downloader_settings;
REVOKE SELECT ON public.downloader_settings FROM anon;
CREATE POLICY "settings admin read" ON public.downloader_settings
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'administrator'::app_role));

-- Atomic fixed-window rate limit counter (service role only).
CREATE OR REPLACE FUNCTION public.hit_rate_limit(_bucket text, _scope text, _window_start timestamptz)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.rate_limits (bucket_key, scope, window_start, count)
  VALUES (_bucket, _scope, _window_start, 1)
  ON CONFLICT (bucket_key, scope, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count;
$$;
REVOKE ALL ON FUNCTION public.hit_rate_limit(text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(text, text, timestamptz) TO service_role;

-- Realtime updates for a user's own jobs
ALTER TABLE public.download_jobs REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.download_jobs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;