-- Academy modules/lessons: restrict reads to published courses (admins see all)
DROP POLICY IF EXISTS "Authenticated can read modules" ON public.academy_modules;
DROP POLICY IF EXISTS "Anyone can read modules" ON public.academy_modules;
DROP POLICY IF EXISTS "modules_select" ON public.academy_modules;
DROP POLICY IF EXISTS "Modules are viewable" ON public.academy_modules;

CREATE POLICY "Modules of published courses are readable"
ON public.academy_modules FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'administrator')
  OR EXISTS (
    SELECT 1 FROM public.academy_courses c
    WHERE c.id = academy_modules.course_id AND c.published = true
  )
);

DROP POLICY IF EXISTS "Authenticated can read lessons" ON public.academy_lessons;
DROP POLICY IF EXISTS "Anyone can read lessons" ON public.academy_lessons;
DROP POLICY IF EXISTS "lessons_select" ON public.academy_lessons;
DROP POLICY IF EXISTS "Lessons are viewable" ON public.academy_lessons;

CREATE POLICY "Lessons of published courses are readable"
ON public.academy_lessons FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'administrator')
  OR EXISTS (
    SELECT 1 FROM public.academy_courses c
    WHERE c.id = academy_lessons.course_id AND c.published = true
  )
);

-- Project comments: authors can edit their own, authors/admins can delete
DROP POLICY IF EXISTS "Authors can update own comments" ON public.api_project_comments;
CREATE POLICY "Authors can update own comments"
ON public.api_project_comments FOR UPDATE TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Authors or admins can delete comments" ON public.api_project_comments;
CREATE POLICY "Authors or admins can delete comments"
ON public.api_project_comments FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'administrator'));