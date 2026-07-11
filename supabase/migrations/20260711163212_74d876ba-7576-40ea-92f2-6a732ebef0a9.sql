
-- ============ WEBSITE REQUESTS ============
CREATE TABLE public.website_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_kind TEXT NOT NULL DEFAULT 'web',
  website_type TEXT,
  booking_type TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'submitted',
  admin_notes TEXT,
  estimated_price NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'KES',
  estimated_days INTEGER,
  deposit_percent INTEGER DEFAULT 50,
  quote_token TEXT UNIQUE,
  quoted_at TIMESTAMPTZ,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.website_requests TO authenticated;
GRANT ALL ON public.website_requests TO service_role;
ALTER TABLE public.website_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own request" ON public.website_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users read own request" ON public.website_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users update own draft" ON public.website_requests
  FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status IN ('submitted','info_requested'))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read all requests" ON public.website_requests
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));
CREATE POLICY "admins update requests" ON public.website_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));

CREATE TRIGGER website_requests_updated
  BEFORE UPDATE ON public.website_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX website_requests_user_idx ON public.website_requests(user_id, created_at DESC);
CREATE INDEX website_requests_status_idx ON public.website_requests(status, created_at DESC);

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- ============ SUPPORT THREADS / MESSAGES ============
CREATE TABLE public.support_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  subject TEXT DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unread_admin INTEGER NOT NULL DEFAULT 0,
  unread_user INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_threads TO authenticated;
GRANT ALL ON public.support_threads TO service_role;
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own thread" ON public.support_threads
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins manage all threads" ON public.support_threads
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));

CREATE TRIGGER support_threads_updated
  BEFORE UPDATE ON public.support_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL DEFAULT 'user',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own thread msgs" ON public.support_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE POLICY "users send own msgs" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = thread_id AND t.user_id = auth.uid())
  );
CREATE POLICY "admins read all msgs" ON public.support_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));
CREATE POLICY "admins send msgs" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator')
  );

CREATE INDEX support_messages_thread_idx ON public.support_messages(thread_id, created_at);

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.website_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  method TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending_confirmation',
  reference TEXT,
  marked_paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own payments" ON public.payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own payments" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read all payments" ON public.payments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));
CREATE POLICY "admins update payments" ON public.payments
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));

CREATE TRIGGER payments_updated
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SITE SETTINGS EXTENSIONS ============
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS whatsapp_bot_url TEXT,
  ADD COLUMN IF NOT EXISTS cloud_solutions_url TEXT,
  ADD COLUMN IF NOT EXISTS hero_title TEXT,
  ADD COLUMN IF NOT EXISTS hero_subtitle TEXT;

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.website_requests;
