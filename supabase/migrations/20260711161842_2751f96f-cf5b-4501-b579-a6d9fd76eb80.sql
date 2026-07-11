
CREATE POLICY "admins insert tokens" ON public.access_tokens
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));

CREATE POLICY "admins update tokens" ON public.access_tokens
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));

CREATE POLICY "users consume own token" ON public.access_tokens
  FOR UPDATE TO authenticated
  USING (consumed_by IS NULL AND revoked = false)
  WITH CHECK (consumed_by = auth.uid());

CREATE POLICY "admins delete tokens" ON public.access_tokens
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'));
