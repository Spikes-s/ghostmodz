
-- COURSES
CREATE TABLE public.academy_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  track text NOT NULL DEFAULT 'coding',
  topic text,
  tagline text,
  description text,
  icon text,
  cover_url text,
  difficulty text NOT NULL DEFAULT 'beginner',
  estimated_hours integer NOT NULL DEFAULT 40,
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.academy_courses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.academy_courses TO authenticated;
GRANT ALL ON public.academy_courses TO service_role;
ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses readable" ON public.academy_courses FOR SELECT TO authenticated USING (published OR public.has_role(auth.uid(),'administrator'));
CREATE POLICY "courses admin insert" ON public.academy_courses FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "courses admin update" ON public.academy_courses FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "courses admin delete" ON public.academy_courses FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER academy_courses_updated BEFORE UPDATE ON public.academy_courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MODULES
CREATE TABLE public.academy_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'beginner',
  title text NOT NULL,
  summary text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_modules TO authenticated;
GRANT ALL ON public.academy_modules TO service_role;
ALTER TABLE public.academy_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules readable" ON public.academy_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "modules admin write" ON public.academy_modules FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "modules admin update" ON public.academy_modules FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "modules admin delete" ON public.academy_modules FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER academy_modules_updated BEFORE UPDATE ON public.academy_modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LESSONS
CREATE TABLE public.academy_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.academy_modules(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_md text,
  code_examples jsonb NOT NULL DEFAULT '[]'::jsonb,
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
  quiz jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  homework text,
  resources jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_minutes integer NOT NULL DEFAULT 30,
  sort_order integer NOT NULL DEFAULT 0,
  generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_lessons TO authenticated;
GRANT ALL ON public.academy_lessons TO service_role;
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons readable" ON public.academy_lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "lessons admin insert" ON public.academy_lessons FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "lessons admin update" ON public.academy_lessons FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "lessons admin delete" ON public.academy_lessons FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER academy_lessons_updated BEFORE UPDATE ON public.academy_lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ENROLLMENTS
CREATE TABLE public.academy_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.academy_courses(id) ON DELETE SET NULL,
  request_id uuid REFERENCES public.website_requests(id) ON DELETE SET NULL,
  track text NOT NULL DEFAULT 'coding',
  status text NOT NULL DEFAULT 'active',
  hours_per_day numeric NOT NULL DEFAULT 2,
  study_days jsonb NOT NULL DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb,
  experience_level text NOT NULL DEFAULT 'beginner',
  target_completion date,
  onboarded boolean NOT NULL DEFAULT false,
  welcomed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX academy_enroll_user_course ON public.academy_enrollments(user_id, course_id) WHERE course_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_enrollments TO authenticated;
GRANT ALL ON public.academy_enrollments TO service_role;
ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enroll own select" ON public.academy_enrollments FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator'));
CREATE POLICY "enroll own insert" ON public.academy_enrollments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "enroll own update" ON public.academy_enrollments FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator'));
CREATE POLICY "enroll admin delete" ON public.academy_enrollments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER academy_enrollments_updated BEFORE UPDATE ON public.academy_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- STUDY PLAN
CREATE TABLE public.academy_study_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.academy_enrollments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_for date NOT NULL,
  lesson_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  minutes integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_study_plan TO authenticated;
GRANT ALL ON public.academy_study_plan TO service_role;
ALTER TABLE public.academy_study_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan own" ON public.academy_study_plan FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator')) WITH CHECK (auth.uid() = user_id);

-- PROGRESS
CREATE TABLE public.academy_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  quiz_score integer,
  quiz_total integer,
  minutes_spent integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_progress TO authenticated;
GRANT ALL ON public.academy_progress TO service_role;
ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress own" ON public.academy_progress FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator')) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER academy_progress_updated BEFORE UPDATE ON public.academy_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ACHIEVEMENTS
CREATE TABLE public.academy_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  icon text,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
GRANT SELECT, INSERT ON public.academy_achievements TO authenticated;
GRANT ALL ON public.academy_achievements TO service_role;
ALTER TABLE public.academy_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achv own select" ON public.academy_achievements FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator'));
CREATE POLICY "achv own insert" ON public.academy_achievements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- STREAKS
CREATE TABLE public.academy_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  minutes integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, day)
);
GRANT SELECT, INSERT, UPDATE ON public.academy_activity TO authenticated;
GRANT ALL ON public.academy_activity TO service_role;
ALTER TABLE public.academy_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity own" ON public.academy_activity FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator')) WITH CHECK (auth.uid() = user_id);

-- CERTIFICATES
CREATE TABLE public.academy_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  certificate_code text NOT NULL UNIQUE,
  student_name text NOT NULL,
  course_title text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
GRANT SELECT, INSERT ON public.academy_certificates TO authenticated;
GRANT ALL ON public.academy_certificates TO service_role;
ALTER TABLE public.academy_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cert own select" ON public.academy_certificates FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'administrator'));
CREATE POLICY "cert own insert" ON public.academy_certificates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
