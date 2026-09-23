DROP POLICY IF EXISTS "site settings public read" ON public.site_settings;
DROP POLICY IF EXISTS "modules readable" ON public.academy_modules;
DROP POLICY IF EXISTS "lessons readable" ON public.academy_lessons;

CREATE POLICY "admins read site settings"
ON public.site_settings
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'administrator'::app_role));

REVOKE SELECT ON public.site_settings FROM anon;