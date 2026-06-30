
-- Access tokens (per-session redemption)
CREATE TABLE public.access_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  label TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  consumed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_tokens TO authenticated;
GRANT ALL ON public.access_tokens TO service_role;
ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;
-- Only admins manage tokens via service role server fns; no direct client policies needed beyond admin checks.
CREATE POLICY "admins read tokens" ON public.access_tokens FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));
CREATE TRIGGER access_tokens_set_updated BEFORE UPDATE ON public.access_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Token requests by users
CREATE TABLE public.token_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|approved|denied
  issued_token_id UUID REFERENCES public.access_tokens(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.token_requests TO authenticated;
GRANT ALL ON public.token_requests TO service_role;
ALTER TABLE public.token_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own requests" ON public.token_requests FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));
CREATE POLICY "users create own requests" ON public.token_requests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins update requests" ON public.token_requests FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));
CREATE TRIGGER token_requests_set_updated BEFORE UPDATE ON public.token_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Site settings (singleton row)
CREATE TABLE public.site_settings (
  id INT PRIMARY KEY DEFAULT 1,
  site_name TEXT NOT NULL DEFAULT 'Ghost Mods Tech',
  logo_url TEXT,
  favicon_url TEXT,
  description TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  socials JSONB NOT NULL DEFAULT '{}'::jsonb,
  footer_text TEXT,
  homepage_banner TEXT,
  seo_title TEXT,
  seo_description TEXT,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site settings public read" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "admins update site settings" ON public.site_settings FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));
CREATE POLICY "admins insert site settings" ON public.site_settings FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));
CREATE TRIGGER site_settings_set_updated BEFORE UPDATE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Services CMS
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  image_url TEXT,
  link_type TEXT NOT NULL DEFAULT 'internal', -- internal|external
  link_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services public read published" ON public.services FOR SELECT USING (published = true OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));
CREATE POLICY "admins write services" ON public.services FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));
CREATE TRIGGER services_set_updated BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
