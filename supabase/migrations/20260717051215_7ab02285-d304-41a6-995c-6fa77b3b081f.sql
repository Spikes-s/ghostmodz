
-- Restrict ai_support_settings SELECT to administrators only
DROP POLICY IF EXISTS "auth read ai settings" ON public.ai_support_settings;
DROP POLICY IF EXISTS "admins write ai settings" ON public.ai_support_settings;

CREATE POLICY "admins read ai settings"
ON public.ai_support_settings
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'administrator'
));

CREATE POLICY "admins write ai settings"
ON public.ai_support_settings
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'administrator'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'administrator'
));

-- Remove the unsafe token-consumption policy. Redemption is handled
-- server-side via the redeemAccessToken server function using the service role.
DROP POLICY IF EXISTS "users consume own token" ON public.access_tokens;

-- Lock down SECURITY DEFINER function EXECUTE grants. These functions are
-- invoked by triggers or the service role and should not be callable from
-- the exposed Data API by anon/authenticated users.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_primary_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
