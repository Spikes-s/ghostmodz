import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const TutorSchema = z.object({
  lesson_id: z.string().uuid(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(30),
});

/**
 * Spikes AI Tutor — answers questions grounded in the current lesson.
 */
export const askTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TutorSchema.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI tutor is not configured yet.");

    const { data: lesson } = await context.supabase
      .from("academy_lessons")
      .select("title,summary,content_md,objectives, module:academy_modules(title,level), course:academy_courses(title,track)")
      .eq("id", data.lesson_id)
      .maybeSingle();
    if (!lesson) throw new Error("Lesson not found");

    const objectives = Array.isArray(lesson.objectives) ? (lesson.objectives as string[]).join("; ") : "";
    const body = String(lesson.content_md ?? "").slice(0, 12000);
    const course: any = lesson.course;
    const mod: any = lesson.module;

    const system = `You are Spikes, the Ghost Modz Academy AI tutor. You are patient, encouraging and precise.
You are tutoring a ${mod?.level ?? "beginner"} student inside the course "${course?.title ?? "Ghost Modz Academy"}".
Current lesson: "${lesson.title}" (module: "${mod?.title ?? ""}").
Learning objectives: ${objectives || "n/a"}.

LESSON MATERIAL (ground your answers in this):
"""
${body}
"""

Rules:
- Answer in short, clear markdown. Use fenced code blocks for code.
- Prefer explaining the concept over giving the finished answer; give the answer if the student asks directly.
- If a question is outside this lesson, answer briefly and steer back to the lesson.
${course?.track === "cybersecurity" ? "- Security topics are strictly defensive and for authorized lab environments only. Never give instructions for attacking systems the student does not own." : ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });

    if (res.status === 429) throw new Error("The tutor is busy right now — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits are exhausted. Please contact the administrator.");
    if (!res.ok) {
      const text = await res.text();
      console.error(`AI tutor failed [${res.status}]: ${text}`);
      throw new Error("The tutor could not answer that. Please try again.");
    }

    const json: any = await res.json();
    const reply = String(json.choices?.[0]?.message?.content ?? "").trim();
    return { reply: reply || "I'm not sure how to answer that — try rephrasing your question." };
  });
