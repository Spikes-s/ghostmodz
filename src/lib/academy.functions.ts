import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ------------------------- helpers ------------------------- */

async function isAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "administrator")
    .maybeSingle();
  return !!data;
}

const LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;

function certCode() {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += abc[bytes[i] % abc.length];
  return `GMA-${s.slice(0, 4)}-${s.slice(4, 8)}`;
}

/* ------------------------- catalog ------------------------- */

export const listCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("academy_courses")
      .select("*")
      .eq("published", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* ------------------------- enrollment ------------------------- */

const EnrollSchema = z.object({
  course_id: z.string().uuid(),
  hours_per_day: z.number().min(0.5).max(12),
  study_days: z.array(z.string().max(4)).min(1),
  experience_level: z.enum(["beginner", "some", "intermediate", "advanced"]),
  target_completion: z.string().max(20).nullable().optional(),
});

export const enrollInCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EnrollSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: course } = await context.supabase
      .from("academy_courses")
      .select("id,track,title,slug")
      .eq("id", data.course_id)
      .maybeSingle();
    if (!course) throw new Error("Course not found");

    const { data: row, error } = await context.supabase
      .from("academy_enrollments")
      .upsert(
        {
          user_id: context.userId,
          course_id: data.course_id,
          track: course.track,
          hours_per_day: data.hours_per_day,
          study_days: data.study_days,
          experience_level: data.experience_level,
          target_completion: data.target_completion || null,
          onboarded: true,
          status: "active",
        },
        { onConflict: "user_id,course_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { enrollment: row, slug: course.slug };
  });

export const listMyEnrollments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("academy_enrollments")
      .select("*, course:academy_courses(*)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markWelcomed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("academy_enrollments")
      .update({ welcomed: true })
      .eq("user_id", context.userId)
      .eq("welcomed", false);
    return { ok: true };
  });

/* ------------------------- roadmap (AI generated, cached) ------------------------- */

export const getRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: course } = await context.supabase
      .from("academy_courses")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!course) throw new Error("Course not found");

    let { data: modules } = await context.supabase
      .from("academy_modules")
      .select("*, lessons:academy_lessons(id,title,slug,sort_order,estimated_minutes)")
      .eq("course_id", course.id)
      .order("sort_order");

    if (!modules?.length) {
      await buildRoadmap(course);
      const res = await context.supabase
        .from("academy_modules")
        .select("*, lessons:academy_lessons(id,title,slug,sort_order,estimated_minutes)")
        .eq("course_id", course.id)
        .order("sort_order");
      modules = res.data ?? [];
    }

    const { data: progress } = await context.supabase
      .from("academy_progress")
      .select("lesson_id,completed,quiz_score,quiz_total")
      .eq("user_id", context.userId)
      .eq("course_id", course.id);

    return { course, modules: modules ?? [], progress: progress ?? [] };
  });

async function buildRoadmap(course: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const key = process.env.LOVABLE_API_KEY;
  let plan: any[] | null = null;

  if (key) {
    try {
      const prompt = `Design a complete curriculum roadmap for a "${course.title}" course (${course.track}).
Return STRICT JSON only: an array of 8 to 12 modules.
Each module: {"level":"beginner|intermediate|advanced|expert","title":string,"summary":string,"lessons":[{"title":string,"minutes":number}]}
Order modules beginner -> expert. 4-7 lessons per module, realistic lesson titles teaching real concepts.
${course.track === "cybersecurity" ? "Focus strictly on legal, defensive, authorized security education practiced in isolated labs." : ""}`;
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const j: any = await res.json();
        const raw = j.choices?.[0]?.message?.content ?? "";
        const parsed = JSON.parse(raw);
        plan = Array.isArray(parsed) ? parsed : (parsed.modules ?? parsed.roadmap ?? null);
      }
    } catch {
      plan = null;
    }
  }

  if (!plan?.length) {
    plan = LEVELS.map((level, i) => ({
      level,
      title: `${course.title} — ${level[0].toUpperCase()}${level.slice(1)}`,
      summary: `Core ${level} concepts and practice for ${course.title}.`,
      lessons: Array.from({ length: 5 }, (_, k) => ({
        title: `${course.title} ${level} lesson ${k + 1}`,
        minutes: 30,
      })),
    })).map((m, i) => ({ ...m, _i: i }));
  }

  let order = 0;
  for (const m of plan) {
    const { data: mod } = await supabaseAdmin
      .from("academy_modules")
      .insert({
        course_id: course.id,
        level: LEVELS.includes(m.level) ? m.level : "beginner",
        title: String(m.title ?? "Module").slice(0, 160),
        summary: String(m.summary ?? "").slice(0, 500),
        sort_order: order++,
      })
      .select("id")
      .single();
    if (!mod) continue;
    const lessons = (m.lessons ?? []).slice(0, 12);
    const rows = lessons.map((l: any, i: number) => ({
      module_id: mod.id,
      course_id: course.id,
      title: String(l.title ?? `Lesson ${i + 1}`).slice(0, 200),
      slug: `l-${order}-${i}`,
      estimated_minutes: Math.min(180, Math.max(10, Number(l.minutes) || 30)),
      sort_order: i,
    }));
    if (rows.length) await supabaseAdmin.from("academy_lessons").insert(rows);
  }
}

/* ------------------------- study plan ------------------------- */

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const generateStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enrollment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: enr } = await context.supabase
      .from("academy_enrollments")
      .select("*")
      .eq("id", data.enrollment_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!enr) throw new Error("Enrollment not found");

    const { data: lessons } = await context.supabase
      .from("academy_lessons")
      .select("id,estimated_minutes,sort_order,module_id")
      .eq("course_id", enr.course_id as string)
      .order("sort_order");
    if (!lessons?.length) return { days: 0 };

    await context.supabase.from("academy_study_plan").delete().eq("enrollment_id", enr.id);

    const budget = Math.round(Number(enr.hours_per_day) * 60);
    const days: string[] = ((enr.study_days as string[] | null) ?? []).map((d) => String(d).toLowerCase());

    const rows: any[] = [];
    const cursor = new Date();
    let guard = 0;
    let batch: string[] = [];
    let mins = 0;

    const push = (date: Date) => {
      if (!batch.length) return;
      rows.push({
        enrollment_id: enr.id,
        user_id: context.userId,
        scheduled_for: date.toISOString().slice(0, 10),
        lesson_ids: batch,
        minutes: mins,
      });
      batch = [];
      mins = 0;
    };

    for (const l of lessons) {
      while (guard < 2000 && !days.includes(DAY_KEYS[cursor.getDay()])) {
        cursor.setDate(cursor.getDate() + 1);
        guard++;
      }
      if (mins + l.estimated_minutes > budget && batch.length) {
        push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
        while (guard < 4000 && !days.includes(DAY_KEYS[cursor.getDay()])) {
          cursor.setDate(cursor.getDate() + 1);
          guard++;
        }
      }
      batch.push(l.id);
      mins += l.estimated_minutes;
    }
    push(new Date(cursor));

    if (rows.length) await context.supabase.from("academy_study_plan").insert(rows);
    return { days: rows.length };
  });

export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("academy_study_plan")
      .select("*")
      .eq("user_id", context.userId)
      .order("scheduled_for")
      .limit(14);
    return data ?? [];
  });

/* ------------------------- progress + achievements ------------------------- */

async function award(userId: string, code: string, title: string, description: string, icon: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("academy_achievements")
    .upsert({ user_id: userId, code, title, description, icon }, { onConflict: "user_id,code" });
}

/** Autosave: records time spent on a lesson without marking it complete. */
export const saveLessonProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        lesson_id: z.string().uuid(),
        course_id: z.string().uuid(),
        minutes: z.number().min(0).max(600).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("academy_progress")
      .select("id,completed,minutes_spent")
      .eq("user_id", context.userId)
      .eq("lesson_id", data.lesson_id)
      .maybeSingle();

    const minutes = Math.max(Math.round(data.minutes), existing?.minutes_spent ?? 0);

    if (existing) {
      await context.supabase
        .from("academy_progress")
        .update({ minutes_spent: minutes })
        .eq("id", existing.id);
    } else {
      await context.supabase.from("academy_progress").insert({
        user_id: context.userId,
        course_id: data.course_id,
        lesson_id: data.lesson_id,
        completed: false,
        minutes_spent: minutes,
      });
    }

    if (minutes > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: act } = await context.supabase
        .from("academy_activity")
        .select("id,minutes")
        .eq("user_id", context.userId)
        .eq("day", today)
        .maybeSingle();
      if (act) {
        if (minutes > (act.minutes ?? 0))
          await context.supabase.from("academy_activity").update({ minutes }).eq("id", act.id);
      } else {
        await context.supabase
          .from("academy_activity")
          .insert({ user_id: context.userId, day: today, minutes });
      }
    }

    return { ok: true, minutes, completed: !!existing?.completed };
  });



export const completeLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        lesson_id: z.string().uuid(),
        course_id: z.string().uuid(),
        minutes: z.number().min(0).max(600).default(0),
        quiz_score: z.number().min(0).max(100).nullable().optional(),
        quiz_total: z.number().min(0).max(100).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("academy_progress").upsert(
      {
        user_id: context.userId,
        course_id: data.course_id,
        lesson_id: data.lesson_id,
        completed: true,
        minutes_spent: data.minutes,
        quiz_score: data.quiz_score ?? null,
        quiz_total: data.quiz_total ?? null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" },
    );
    if (error) throw new Error(error.message);

    const today = new Date().toISOString().slice(0, 10);
    await context.supabase
      .from("academy_activity")
      .upsert({ user_id: context.userId, day: today, minutes: data.minutes }, { onConflict: "user_id,day" });

    const { count } = await context.supabase
      .from("academy_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("completed", true);

    if ((count ?? 0) >= 1)
      await award(context.userId, "first_lesson", "First Lesson Completed", "You started the journey.", "Sparkles");
    if (data.quiz_total && data.quiz_score === data.quiz_total)
      await award(context.userId, "perfect_score", "Perfect Score", "Aced a quiz with 100%.", "Target");
    if ((count ?? 0) >= 10)
      await award(context.userId, "quiz_master", "Ten Lessons Down", "Completed 10 lessons.", "Trophy");

    // Auto-issue the certificate the moment the final lesson of a course is done.
    const certificate = await maybeIssueCertificate(context, data.course_id);

    return { ok: true, completed: count ?? 0, certificate };
  });

/** Issues a certificate when every lesson in the course is complete. Returns null otherwise. */
async function maybeIssueCertificate(context: { supabase: any; userId: string }, courseId: string) {
  const { count: total } = await context.supabase
    .from("academy_lessons")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  if (!total) return null;

  const { count: done } = await context.supabase
    .from("academy_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.userId)
    .eq("course_id", courseId)
    .eq("completed", true);
  if ((done ?? 0) < total) return null;

  const { data: existing } = await context.supabase
    .from("academy_certificates")
    .select("*")
    .eq("user_id", context.userId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (existing) return existing;

  const [{ data: course }, { data: profile }] = await Promise.all([
    context.supabase.from("academy_courses").select("id,title").eq("id", courseId).maybeSingle(),
    context.supabase.from("profiles").select("full_name,username,email").eq("id", context.userId).maybeSingle(),
  ]);
  if (!course) return null;

  const { data: row, error } = await context.supabase
    .from("academy_certificates")
    .insert({
      user_id: context.userId,
      course_id: courseId,
      certificate_code: certCode(),
      student_name: profile?.full_name || profile?.username || profile?.email || "Ghost Modz Student",
      course_title: course.title,
    })
    .select("*")
    .single();
  if (error) {
    console.error("Certificate issue failed:", error.message);
    return null;
  }

  await award(context.userId, "course_completed", "Course Completed", `Finished ${course.title}.`, "Award");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("notifications").insert({
    user_id: context.userId,
    kind: "academy",
    title: "Certificate unlocked",
    body: `You completed ${course.title}. Your certificate is ready.`,
    link: `/academy/certificate/${row.certificate_code}`,
  });

  return row;
}


/* ------------------------- dashboard ------------------------- */

export const getAcademyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: enrollments }, { data: achievements }, { data: activity }, { data: certificates }] =
      await Promise.all([
        context.supabase
          .from("academy_enrollments")
          .select("*, course:academy_courses(*)")
          .eq("user_id", context.userId),
        context.supabase
          .from("academy_achievements")
          .select("*")
          .eq("user_id", context.userId)
          .order("earned_at", { ascending: false }),
        context.supabase
          .from("academy_activity")
          .select("day,minutes")
          .eq("user_id", context.userId)
          .order("day", { ascending: false })
          .limit(60),
        context.supabase.from("academy_certificates").select("*").eq("user_id", context.userId),
      ]);

    const { data: progress } = await context.supabase
      .from("academy_progress")
      .select("course_id,lesson_id,completed,minutes_spent")
      .eq("user_id", context.userId);

    const courseIds = (enrollments ?? []).map((e: any) => e.course_id).filter(Boolean);
    let totals: Record<string, number> = {};
    if (courseIds.length) {
      const { data: allLessons } = await context.supabase
        .from("academy_lessons")
        .select("id,course_id")
        .in("course_id", courseIds);
      for (const l of allLessons ?? []) totals[l.course_id] = (totals[l.course_id] ?? 0) + 1;
    }

    // streak
    const days = new Set((activity ?? []).map((a: any) => a.day));
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const key = d.toISOString().slice(0, 10);
      if (days.has(key)) streak++;
      else if (i > 0) break;
      d.setDate(d.getDate() - 1);
    }

    const minutesTotal = (progress ?? []).reduce((s: number, p: any) => s + (p.minutes_spent ?? 0), 0);

    // next lesson per enrollment
    const next: Record<string, any> = {};
    for (const cid of courseIds) {
      const done = new Set(
        (progress ?? []).filter((p: any) => p.course_id === cid && p.completed).map((p: any) => p.lesson_id),
      );
      const { data: ls } = await context.supabase
        .from("academy_lessons")
        .select("id,title,course_id,module_id,sort_order")
        .eq("course_id", cid)
        .order("sort_order")
        .limit(200);
      next[cid] = (ls ?? []).find((l: any) => !done.has(l.id)) ?? null;
    }

    return {
      enrollments: enrollments ?? [],
      achievements: achievements ?? [],
      certificates: certificates ?? [],
      progress: progress ?? [],
      totals,
      streak,
      minutesTotal,
      next,
    };
  });

/* ------------------------- certificates ------------------------- */

export const issueCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ course_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: course } = await context.supabase
      .from("academy_courses")
      .select("id,title")
      .eq("id", data.course_id)
      .maybeSingle();
    if (!course) throw new Error("Course not found");

    const { count: total } = await context.supabase
      .from("academy_lessons")
      .select("id", { count: "exact", head: true })
      .eq("course_id", data.course_id);
    const { count: done } = await context.supabase
      .from("academy_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("course_id", data.course_id)
      .eq("completed", true);
    if (!total || (done ?? 0) < total) throw new Error("Course not fully completed yet");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name,username,email")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: existing } = await context.supabase
      .from("academy_certificates")
      .select("*")
      .eq("user_id", context.userId)
      .eq("course_id", data.course_id)
      .maybeSingle();
    if (existing) return existing;

    const { data: row, error } = await context.supabase
      .from("academy_certificates")
      .insert({
        user_id: context.userId,
        course_id: data.course_id,
        certificate_code: certCode(),
        student_name: profile?.full_name || profile?.username || profile?.email || "Ghost Modz Student",
        course_title: course.title,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await award(context.userId, "course_completed", "Course Completed", `Finished ${course.title}.`, "Award");
    return row;
  });

/* ------------------------- admin ------------------------- */

export const adminAcademyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [courses, enrollments, certs, progress] = await Promise.all([
      supabaseAdmin.from("academy_courses").select("*").order("sort_order"),
      supabaseAdmin
        .from("academy_enrollments")
        .select("*, course:academy_courses(title,slug), profile:profiles(full_name,email,username)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("academy_certificates").select("*").order("issued_at", { ascending: false }).limit(100),
      supabaseAdmin.from("academy_progress").select("user_id,course_id,completed"),
    ]);
    return {
      courses: courses.data ?? [],
      enrollments: enrollments.data ?? [],
      certificates: certs.data ?? [],
      progress: progress.data ?? [],
    };
  });

export const setCoursePublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), published: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("academy_courses").update({ published: data.published }).eq("id", data.id);
    return { ok: true };
  });
