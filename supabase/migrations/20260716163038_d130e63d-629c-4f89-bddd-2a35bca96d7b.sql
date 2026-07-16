
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

ALTER TABLE public.support_threads
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS admin_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'ai';

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS language text;

CREATE TABLE IF NOT EXISTS public.ai_support_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_globally_enabled boolean NOT NULL DEFAULT true,
  welcome_message text NOT NULL DEFAULT 'Hi! I''m the Ghost Mods Tech AI assistant. How can I help?',
  business_description text NOT NULL DEFAULT 'Ghost Mods Tech builds websites, mobile apps, APIs, and AI-powered tools.',
  business_hours text NOT NULL DEFAULT 'Mon–Fri 9:00–18:00 EAT',
  contact_details text NOT NULL DEFAULT '',
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  response_style text NOT NULL DEFAULT 'friendly, professional, concise',
  max_response_length integer NOT NULL DEFAULT 400,
  supported_languages text[] NOT NULL DEFAULT ARRAY['English','Swahili','French','Spanish','German','Portuguese','Arabic','Chinese','Japanese','Hindi'],
  escalation_rules text NOT NULL DEFAULT 'Offer to connect a human admin if the user is frustrated, asks for a person, or the question is outside the business info.',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_support_settings TO authenticated;
GRANT ALL ON public.ai_support_settings TO service_role;
ALTER TABLE public.ai_support_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read ai settings" ON public.ai_support_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write ai settings" ON public.ai_support_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrator'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'administrator'::public.app_role));
INSERT INTO public.ai_support_settings (id) SELECT gen_random_uuid()
  WHERE NOT EXISTS (SELECT 1 FROM public.ai_support_settings);
CREATE TRIGGER ai_support_settings_updated BEFORE UPDATE ON public.ai_support_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.api_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  api_type text NOT NULL DEFAULT 'REST',
  base_url text DEFAULT '',
  version text NOT NULL DEFAULT 'v1',
  auth_type text NOT NULL DEFAULT 'none',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_projects TO authenticated;
GRANT ALL ON public.api_projects TO service_role;
ALTER TABLE public.api_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages api projects" ON public.api_projects
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins read api projects" ON public.api_projects
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'administrator'::public.app_role));
CREATE TRIGGER api_projects_updated BEFORE UPDATE ON public.api_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.api_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.api_projects(id) ON DELETE CASCADE,
  route text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  description text DEFAULT '',
  parameters jsonb NOT NULL DEFAULT '[]'::jsonb,
  headers jsonb NOT NULL DEFAULT '[]'::jsonb,
  request_body jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_body jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_endpoints TO authenticated;
GRANT ALL ON public.api_endpoints TO service_role;
ALTER TABLE public.api_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages endpoints" ON public.api_endpoints
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.api_projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.api_projects p WHERE p.id = project_id AND p.user_id = auth.uid()));
CREATE POLICY "admins read endpoints" ON public.api_endpoints
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'administrator'::public.app_role));
CREATE TRIGGER api_endpoints_updated BEFORE UPDATE ON public.api_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.api_env_vars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.api_projects(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_env_vars TO authenticated;
GRANT ALL ON public.api_env_vars TO service_role;
ALTER TABLE public.api_env_vars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages env vars" ON public.api_env_vars
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.api_projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.api_projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.api_project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.api_projects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.api_project_comments TO authenticated;
GRANT ALL ON public.api_project_comments TO service_role;
ALTER TABLE public.api_project_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner and admin read comments" ON public.api_project_comments
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'administrator'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.api_projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  );
CREATE POLICY "admins insert comments" ON public.api_project_comments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'administrator'::public.app_role) AND author_id = auth.uid());

INSERT INTO public.services (slug, title, tagline, description, icon, link_type, link_url, sort_order, published)
SELECT 'api-dev', 'API Development Platform',
  'Design, test and document your own APIs',
  'Guided workspace to build REST, GraphQL, webhook and auth APIs with Spikes Bot assistance.',
  'Code2', 'internal', '/services/api-dev/new', 50, true
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE slug = 'api-dev');
