
-- ============ HOSTING PLANS ============
CREATE TABLE public.hosting_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'app',
  tagline text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  price_monthly numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'KES',
  cpu_cores numeric NOT NULL DEFAULT 1,
  ram_mb integer NOT NULL DEFAULT 512,
  disk_gb integer NOT NULL DEFAULT 5,
  bandwidth_gb integer NOT NULL DEFAULT 100,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  popular boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hosting_plans TO authenticated;
GRANT SELECT ON public.hosting_plans TO anon;
GRANT ALL ON public.hosting_plans TO service_role;
ALTER TABLE public.hosting_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans public read" ON public.hosting_plans FOR SELECT TO anon, authenticated
  USING (active OR public.has_role(auth.uid(),'administrator'));
CREATE POLICY "plans admin insert" ON public.hosting_plans FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "plans admin update" ON public.hosting_plans FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "plans admin delete" ON public.hosting_plans FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'administrator'));

-- ============ WALLET ============
CREATE TABLE public.cloud_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'KES',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cloud_wallets TO authenticated;
GRANT ALL ON public.cloud_wallets TO service_role;
ALTER TABLE public.cloud_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet own read" ON public.cloud_wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator'));

CREATE TABLE public.cloud_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'topup',
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  status text NOT NULL DEFAULT 'pending',
  method text NOT NULL DEFAULT 'mpesa',
  reference text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cloud_transactions TO authenticated;
GRANT ALL ON public.cloud_transactions TO service_role;
ALTER TABLE public.cloud_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx own read" ON public.cloud_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator'));
CREATE INDEX cloud_tx_user_idx ON public.cloud_transactions(user_id, created_at DESC);

-- ============ CLOUD APPS ============
CREATE TABLE public.cloud_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  repo_url text NOT NULL DEFAULT '',
  branch text NOT NULL DEFAULT 'main',
  runtime text NOT NULL DEFAULT 'node',
  region text NOT NULL DEFAULT 'eu-central',
  plan_id uuid REFERENCES public.hosting_plans(id) ON DELETE SET NULL,
  start_command text NOT NULL DEFAULT '',
  env_vars jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'provisioning',
  health text NOT NULL DEFAULT 'unknown',
  domain text,
  last_deploy_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_apps TO authenticated;
GRANT ALL ON public.cloud_apps TO service_role;
ALTER TABLE public.cloud_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apps own select" ON public.cloud_apps FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator'));
CREATE POLICY "apps own insert" ON public.cloud_apps FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "apps own update" ON public.cloud_apps FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator'));
CREATE POLICY "apps own delete" ON public.cloud_apps FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator'));

CREATE TABLE public.cloud_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.cloud_apps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  trigger text NOT NULL DEFAULT 'manual',
  logs text NOT NULL DEFAULT '',
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT ON public.cloud_deployments TO authenticated;
GRANT ALL ON public.cloud_deployments TO service_role;
ALTER TABLE public.cloud_deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deploys own read" ON public.cloud_deployments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator'));
CREATE INDEX cloud_deploy_app_idx ON public.cloud_deployments(app_id, created_at DESC);

-- ============ VPS ============
CREATE TABLE public.cloud_vps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hostname text NOT NULL,
  plan_id uuid REFERENCES public.hosting_plans(id) ON DELETE SET NULL,
  region text NOT NULL DEFAULT 'eu-central',
  os_image text NOT NULL DEFAULT 'ubuntu-24.04',
  status text NOT NULL DEFAULT 'pending',
  ip_address text,
  root_user text NOT NULL DEFAULT 'root',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_vps TO authenticated;
GRANT ALL ON public.cloud_vps TO service_role;
ALTER TABLE public.cloud_vps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vps own select" ON public.cloud_vps FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator'));
CREATE POLICY "vps own insert" ON public.cloud_vps FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vps admin update" ON public.cloud_vps FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "vps own delete" ON public.cloud_vps FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator'));

-- updated_at triggers
CREATE TRIGGER hosting_plans_updated BEFORE UPDATE ON public.hosting_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cloud_wallets_updated BEFORE UPDATE ON public.cloud_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cloud_tx_updated BEFORE UPDATE ON public.cloud_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cloud_apps_updated BEFORE UPDATE ON public.cloud_apps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cloud_vps_updated BEFORE UPDATE ON public.cloud_vps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- realtime for admin live chat notifications
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;
ALTER TABLE public.support_threads REPLICA IDENTITY FULL;

-- ============ SEED PLANS ============
INSERT INTO public.hosting_plans (slug, name, category, tagline, description, price_monthly, cpu_cores, ram_mb, disk_gb, bandwidth_gb, features, popular, sort_order) VALUES
('app-free','Ghost Free','app','2-day trial slot','Perfect for testing a bot or a small script before you commit.',0,0.5,256,1,10,'["1 app slot","256 MB RAM","Live build logs","Community support","Sleeps after 30 min idle"]',false,1),
('app-hobby','Ghost Hobby','app','Always-on hobby apps','Keep one WhatsApp or Telegram bot alive 24/7 with health checks.',450,1,512,5,100,'["1 always-on app","512 MB RAM","Automatic restarts","Health monitoring","Email downtime alerts"]',false,2),
('app-pro','Ghost Pro','app','For production bots','Multiple production apps with faster builds and priority queueing.',1200,2,2048,20,500,'["5 apps","2 GB RAM","Priority build queue","Custom domains","90-day uptime history","Email + in-app alerts"]',true,3),
('app-business','Ghost Business','app','Teams and agencies','Run a whole client portfolio with team access and SLA support.',3500,4,8192,80,2000,'["Unlimited apps","8 GB RAM","Team seats","99.9% uptime SLA","Priority human support","Daily backups"]',false,4),
('vps-starter','Ghost VPS Starter','vps','Root access VPS','Full root Ubuntu VPS on enterprise hardware, provisioned on request.',1500,2,4096,50,2000,'["2 vCPU","4 GB RAM","50 GB NVMe","Full root access","Ubuntu / Debian images","Weekly snapshot"]',false,5),
('vps-power','Ghost VPS Power','vps','Heavy workloads','Great for panels, databases and multi-bot deployments.',3200,4,8192,120,4000,'["4 vCPU","8 GB RAM","120 GB NVMe","Full root access","Snapshots + rescue mode","DDoS protection"]',true,6),
('vps-elite','Ghost VPS Elite','vps','Dedicated performance','Dedicated cores for latency-sensitive production workloads.',7800,8,16384,300,8000,'["8 dedicated vCPU","16 GB RAM","300 GB NVMe","Private networking","Daily backups","Priority engineering support"]',false,7),
('db-postgres','Ghost Postgres','database','Managed PostgreSQL','Production PostgreSQL with automated backups and instant provisioning.',900,1,1024,20,0,'["Managed PostgreSQL 16","Automated daily backups","Point-in-time restore","Connection pooling","TLS enforced"]',false,8),
('db-keyvalue','Ghost Key-Value','database','Redis-compatible store','In-memory store for caching, queues and sessions.',700,1,512,5,0,'["Redis-compatible API","Persistence enabled","Eviction policies","TLS enforced","Instant provisioning"]',false,9),
('addon-gamepanel','Ghost Game Panel','addon','Pterodactyl game servers','Game server panel with slots for Minecraft, FiveM and more.',1800,2,4096,60,3000,'["Pterodactyl panel","4 server slots","One-click modpacks","SFTP access","Automatic restarts"]',false,10);
