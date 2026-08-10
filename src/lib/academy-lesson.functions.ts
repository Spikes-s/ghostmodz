import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Loads a lesson. If the lesson body has not been authored yet, Spikes generates
 * real educational content on demand and it is cached in the database.
 */
export const getLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lesson_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: lesson } = await context.supabase
      .from("academy_lessons")
      .select("*, module:academy_modules(title,level), course:academy_courses(id,title,slug,track)")
      .eq("id", data.lesson_id)
      .maybeSingle();
    if (!lesson) throw new Error("Lesson not found");

    const { data: progress } = await context.supabase
      .from("academy_progress")
      .select("completed,minutes_spent,quiz_score,quiz_total")
      .eq("user_id", context.userId)
      .eq("lesson_id", data.lesson_id)
      .maybeSingle();

    if (lesson.generated && lesson.content_md) return { ...lesson, progress: progress ?? null };

    const generated = await generateLessonContent(lesson);
    if (!generated) return { ...lesson, progress: progress ?? null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated } = await supabaseAdmin
      .from("academy_lessons")
      .update({ ...generated, generated: true })
      .eq("id", lesson.id)
      .select("*, module:academy_modules(title,level), course:academy_courses(id,title,slug,track)")
      .single();
    return { ...(updated ?? lesson), progress: progress ?? null };
  });


async function generateLessonContent(lesson: any) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const course = lesson.course?.title ?? "the subject";
  const level = lesson.module?.level ?? "beginner";
  const prompt = `Write a complete ${level}-level lesson for a "${course}" course.
Lesson title: "${lesson.title}" (module: "${lesson.module?.title ?? ""}").
${lesson.course?.track === "cybersecurity" ? "This is defensive, legal, authorized security education practiced only in isolated training labs. Never include instructions for attacking systems you do not own." : ""}

Return STRICT JSON with exactly these keys:
{
 "objectives": [3-5 short strings],
 "content_md": "long markdown explanation with headings and fenced code examples",
 "code_examples": [{"title":string,"language":string,"code":string}],
 "exercises": [{"prompt":string,"starter":string,"solution":string}],
 "quiz": [{"question":string,"options":[4 strings],"answer":0,"explanation":string}],
 "summary": "short paragraph",
 "homework": "one practical task",
 "resources": [{"title":string,"url":string,"source":string}]
}
Resources must link to reputable originals (official docs, MDN, freeCodeCamp, Microsoft Learn, Oracle docs, python.org). Do not copy their text — link only. Output JSON only.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    if (!parsed.content_md) return null;
    return {
      objectives: parsed.objectives ?? [],
      content_md: String(parsed.content_md),
      code_examples: parsed.code_examples ?? [],
      exercises: parsed.exercises ?? [],
      quiz: parsed.quiz ?? [],
      summary: parsed.summary ?? null,
      homework: parsed.homework ?? null,
      resources: parsed.resources ?? [],
    };
  } catch {
    return null;
  }
}
