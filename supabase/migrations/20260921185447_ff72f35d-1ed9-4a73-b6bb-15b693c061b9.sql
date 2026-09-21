
-- ============ platforms ============
CREATE TABLE public.platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  extractor text NOT NULL DEFAULT 'yt-dlp',
  status text NOT NULL DEFAULT 'unknown',
  last_checked timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platforms TO anon, authenticated;
GRANT ALL ON public.platforms TO service_role;
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platforms readable" ON public.platforms FOR SELECT TO anon, authenticated USING (enabled OR private.has_role(auth.uid(),'administrator'));
CREATE POLICY "platforms admin write" ON public.platforms FOR ALL TO authenticated USING (private.has_role(auth.uid(),'administrator')) WITH CHECK (private.has_role(auth.uid(),'administrator'));
CREATE TRIGGER platforms_updated BEFORE UPDATE ON public.platforms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ download_jobs ============
CREATE TABLE public.download_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_key text,
  source_url text NOT NULL,
  normalized_url text NOT NULL,
  url_hash text NOT NULL,
  source_platform text,
  media_title text,
  media_type text,
  requested_format text NOT NULL,
  requested_quality text,
  status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  worker_job_id text,
  idempotency_key text,
  error_code text,
  error_message text,
  output_filename text,
  output_size bigint,
  temporary_storage_path text,
  client_ip_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  CONSTRAINT download_jobs_status_chk CHECK (status IN ('queued','analyzing','processing','converting','completed','failed','expired','cancelled')),
  CONSTRAINT download_jobs_progress_chk CHECK (progress >= 0 AND progress <= 100)
);
CREATE INDEX download_jobs_user_idx ON public.download_jobs(user_id);
CREATE INDEX download_jobs_status_idx ON public.download_jobs(status);
CREATE INDEX download_jobs_created_idx ON public.download_jobs(created_at DESC);
CREATE INDEX download_jobs_platform_idx ON public.download_jobs(source_platform);
CREATE INDEX download_jobs_hash_idx ON public.download_jobs(url_hash);
CREATE INDEX download_jobs_expires_idx ON public.download_jobs(expires_at);
CREATE UNIQUE INDEX download_jobs_idem_idx ON public.download_jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;
GRANT SELECT ON public.download_jobs TO authenticated;
GRANT ALL ON public.download_jobs TO service_role;
ALTER TABLE public.download_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own jobs readable" ON public.download_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(),'administrator'));
CREATE TRIGGER download_jobs_updated BEFORE UPDATE ON public.download_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- status transition guard
CREATE OR REPLACE FUNCTION public.guard_download_job_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE allowed text[];
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  allowed := CASE OLD.status
    WHEN 'queued' THEN ARRAY['analyzing','processing','failed','cancelled','expired']
    WHEN 'analyzing' THEN ARRAY['processing','converting','completed','failed','cancelled']
    WHEN 'processing' THEN ARRAY['converting','completed','failed','cancelled']
    WHEN 'converting' THEN ARRAY['completed','failed','cancelled']
    WHEN 'completed' THEN ARRAY['expired']
    WHEN 'failed' THEN ARRAY['queued']
    WHEN 'cancelled' THEN ARRAY['queued']
    WHEN 'expired' THEN ARRAY[]::text[]
    ELSE ARRAY[]::text[] END;
  IF NOT (NEW.status = ANY(allowed)) THEN
    RAISE EXCEPTION 'Invalid job status transition % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER download_jobs_status_guard BEFORE UPDATE OF status ON public.download_jobs FOR EACH ROW EXECUTE FUNCTION public.guard_download_job_status();

-- ============ downloader_settings ============
CREATE TABLE public.downloader_settings (
  id integer PRIMARY KEY DEFAULT 1,
  site_name text NOT NULL DEFAULT 'Ghost Mods Tech',
  logo_url text,
  favicon_url text,
  accent_primary text NOT NULL DEFAULT '#a855f7',
  accent_secondary text NOT NULL DEFAULT '#38bdf8',
  support_email text,
  terms_url text,
  privacy_url text,
  footer_text text,
  meta_title text NOT NULL DEFAULT 'Ghost Mods Tech — Media Downloader',
  meta_description text NOT NULL DEFAULT 'Ghost Mods Tech provides a fast, secure and modern media downloading experience for supported public media sources.',
  guest_downloads_enabled boolean NOT NULL DEFAULT true,
  require_account boolean NOT NULL DEFAULT false,
  downloads_paused boolean NOT NULL DEFAULT false,
  maintenance_mode boolean NOT NULL DEFAULT false,
  file_lifetime_minutes integer NOT NULL DEFAULT 60,
  max_file_size_mb integer NOT NULL DEFAULT 2048,
  max_concurrent_jobs_per_user integer NOT NULL DEFAULT 2,
  max_concurrent_jobs_global integer NOT NULL DEFAULT 25,
  guest_requests_per_hour integer NOT NULL DEFAULT 10,
  user_requests_per_hour integer NOT NULL DEFAULT 60,
  metadata_requests_per_minute integer NOT NULL DEFAULT 10,
  metadata_cache_minutes integer NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT downloader_settings_single CHECK (id = 1)
);
GRANT SELECT ON public.downloader_settings TO anon, authenticated;
GRANT ALL ON public.downloader_settings TO service_role;
ALTER TABLE public.downloader_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.downloader_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "settings admin update" ON public.downloader_settings FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'administrator')) WITH CHECK (private.has_role(auth.uid(),'administrator'));
CREATE TRIGGER downloader_settings_updated BEFORE UPDATE ON public.downloader_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.downloader_settings (id) VALUES (1);

-- ============ rate_limits ============
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL,
  scope text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX rate_limits_bucket_idx ON public.rate_limits(bucket_key, scope, window_start);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- ============ audit_logs ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  target text,
  ip_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON public.audit_logs(created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.audit_logs FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'administrator'));

-- ============ worker_heartbeats ============
CREATE TABLE public.worker_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id text NOT NULL,
  version text,
  active_jobs integer NOT NULL DEFAULT 0,
  queue_length integer NOT NULL DEFAULT 0,
  cpu_percent numeric,
  memory_percent numeric,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  reported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX worker_heartbeats_reported_idx ON public.worker_heartbeats(reported_at DESC);
GRANT SELECT ON public.worker_heartbeats TO authenticated;
GRANT ALL ON public.worker_heartbeats TO service_role;
ALTER TABLE public.worker_heartbeats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "heartbeats admin read" ON public.worker_heartbeats FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'administrator'));

-- ============ analytics_events ============
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.download_jobs(id) ON DELETE SET NULL,
  platform text,
  format text,
  status text,
  duration_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analytics_events_created_idx ON public.analytics_events(created_at DESC);
CREATE INDEX analytics_events_event_idx ON public.analytics_events(event);
GRANT SELECT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics admin read" ON public.analytics_events FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'administrator'));

-- ============ media_metadata_cache ============
CREATE TABLE public.media_metadata_cache (
  url_hash text PRIMARY KEY,
  normalized_url text NOT NULL,
  platform text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX media_metadata_cache_expires_idx ON public.media_metadata_cache(expires_at);
GRANT ALL ON public.media_metadata_cache TO service_role;
ALTER TABLE public.media_metadata_cache ENABLE ROW LEVEL SECURITY;

-- ============ platform registry seed (yt-dlp native extractors) ============
INSERT INTO public.platforms (name, domain, extractor, status, notes) VALUES
 ('YouTube','youtube.com','yt-dlp','unknown','Public videos only. Age/DRM restricted media is rejected.'),
 ('YouTube (short links)','youtu.be','yt-dlp','unknown',NULL),
 ('Vimeo','vimeo.com','yt-dlp','unknown','Public videos only.'),
 ('SoundCloud','soundcloud.com','yt-dlp','unknown','Public tracks only.'),
 ('Dailymotion','dailymotion.com','yt-dlp','unknown',NULL),
 ('Facebook','facebook.com','yt-dlp','unknown','Public posts only.'),
 ('Instagram','instagram.com','yt-dlp','unknown','Public posts only.'),
 ('TikTok','tiktok.com','yt-dlp','unknown','Public videos only.'),
 ('X (Twitter)','x.com','yt-dlp','unknown','Public posts only.'),
 ('Twitter','twitter.com','yt-dlp','unknown','Public posts only.'),
 ('Twitch','twitch.tv','yt-dlp','unknown','Public VODs and clips.'),
 ('Reddit','reddit.com','yt-dlp','unknown','Public posts only.'),
 ('Bandcamp','bandcamp.com','yt-dlp','unknown','Free/public streams only.'),
 ('Direct media file','*','direct','unknown','Direct links to publicly reachable .mp4/.mp3/.wav/.webm/.m4a files.')
ON CONFLICT (domain) DO NOTHING;
