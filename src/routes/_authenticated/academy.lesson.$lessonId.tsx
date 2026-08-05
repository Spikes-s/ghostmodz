import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, CheckCircle2, ExternalLink, Target, ClipboardCheck, Lightbulb } from "lucide-react";
import { getLesson } from "@/lib/academy-lesson.functions";
import { completeLesson } from "@/lib/academy.functions";
import { Markdown } from "@/components/ghost/Markdown";
import { BrandedLoader } from "@/components/ghost/BrandedLoader";
import { AiTutor } from "@/components/ghost/AiTutor";


export const Route = createFileRoute("/_authenticated/academy/lesson/$lessonId")({
  head: () => ({
    meta: [
      { title: "Lesson — Ghost Modz Academy" },
      { name: "description", content: "Interactive lesson with objectives, code examples, quiz and homework." },
      { property: "og:title", content: "Lesson — Ghost Modz Academy" },
      { property: "og:description", content: "Learn with objectives, examples, exercises and a quiz." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LessonPage,
});

function LessonPage() {
  const { lessonId } = Route.useParams();
  const navigate = useNavigate();
  const fn = useServerFn(getLesson);
  const doneFn = useServerFn(completeLesson);
  const { data, isLoading } = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => fn({ data: { lesson_id: lessonId } }),
  });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <BrandedLoader label="Spikes is preparing this lesson…" />;
  if (!data) return <div className="p-10 text-center text-muted-foreground">Lesson not found.</div>;

  const l = data as any;
  const quiz: any[] = Array.isArray(l.quiz) ? l.quiz : [];
  const objectives: string[] = Array.isArray(l.objectives) ? l.objectives : [];
  const resources: any[] = Array.isArray(l.resources) ? l.resources : [];
  const exercises: any[] = Array.isArray(l.exercises) ? l.exercises : [];
  const score = quiz.reduce((s, q, i) => s + (answers[i] === q.answer ? 1 : 0), 0);

  async function finish() {
    setBusy(true);
    try {
      const r: any = await doneFn({
        data: {
          lesson_id: l.id,
          course_id: l.course_id,
          minutes: l.estimated_minutes ?? 30,
          quiz_score: quiz.length ? score : null,
          quiz_total: quiz.length || null,
        },
      });
      if (r?.certificate?.certificate_code) {
        toast.success("Course complete — certificate issued!", {
          description: "Opening your certificate.",
        });
        navigate({ to: "/academy/certificate/$code", params: { code: r.certificate.certificate_code } });
        return;
      }
      toast.success("Lesson completed", { description: "Progress saved." });
      navigate({ to: "/academy/$slug", params: { slug: l.course?.slug ?? "" } });
    } catch (e: any) {
      toast.error(e?.message || "Could not save progress");
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 gap-2"
        onClick={() => navigate({ to: "/academy/$slug", params: { slug: l.course?.slug ?? "" } })}
      >
        <ArrowLeft className="h-4 w-4" /> {l.course?.title}
      </Button>

      <Badge className="mb-2 bg-primary/15 text-primary border border-primary/40 capitalize">
        {l.module?.level} · {l.module?.title}
      </Badge>
      <h1 className="text-3xl font-bold neon-text mb-6">{l.title}</h1>

      {objectives.length > 0 && (
        <Card className="glass-card border-primary/30 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" /> Learning objectives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
              {objectives.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {l.content_md ? (
        <Card className="glass-card border-border/40 mb-6">
          <CardContent className="p-5">
            <Markdown>{l.content_md}</Markdown>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card border-border/40 mb-6">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Lesson content is still being generated. Refresh in a moment.
          </CardContent>
        </Card>
      )}

      {exercises.length > 0 && (
        <Card className="glass-card border-border/40 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-secondary" /> Hands-on exercises
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {exercises.map((ex, i) => (
              <div key={i} className="rounded-lg glass p-4">
                <p className="text-sm mb-2">{ex.prompt}</p>
                {ex.starter && (
                  <pre className="overflow-x-auto rounded-lg border border-primary/30 bg-black/70 p-3 font-mono text-xs">
                    {ex.starter}
                  </pre>
                )}
                {ex.solution && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-secondary">Show solution</summary>
                    <pre className="mt-2 overflow-x-auto rounded-lg border border-border/40 bg-black/60 p-3 font-mono text-xs">
                      {ex.solution}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {quiz.length > 0 && (
        <Card className="glass-card border-border/40 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" /> Quiz
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {quiz.map((q, qi) => (
              <div key={qi}>
                <p className="mb-2 text-sm font-medium">
                  {qi + 1}. {q.question}
                </p>
                <div className="space-y-1.5">
                  {(q.options ?? []).map((opt: string, oi: number) => {
                    const picked = answers[qi] === oi;
                    const correct = submitted && oi === q.answer;
                    const wrong = submitted && picked && oi !== q.answer;
                    return (
                      <button
                        key={oi}
                        disabled={submitted}
                        onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                        className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          correct
                            ? "border-green-500/70 bg-green-500/10"
                            : wrong
                              ? "border-red-500/70 bg-red-500/10"
                              : picked
                                ? "border-primary bg-primary/10"
                                : "border-border/40 hover:border-primary/50"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {submitted && q.explanation && (
                  <p className="mt-2 text-xs text-muted-foreground">{q.explanation}</p>
                )}
              </div>
            ))}
            {!submitted ? (
              <Button onClick={() => setSubmitted(true)} className="w-full" variant="outline">
                Submit answers
              </Button>
            ) : (
              <p className="text-center text-sm">
                Score: <span className="font-bold text-primary">{score}</span> / {quiz.length}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {l.summary && (
        <Card className="glass-card border-border/40 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-secondary" /> Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{l.summary}</p>
            {l.homework && (
              <p>
                <span className="text-foreground font-medium">Homework: </span>
                {l.homework}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {resources.length > 0 && (
        <Card className="glass-card border-border/40 mb-6">
          <CardHeader>
            <CardTitle className="text-base">Recommended resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resources.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg glass px-3 py-2 text-sm hover:text-primary"
              >
                <ExternalLink className="h-3.5 w-3.5 text-secondary" />
                <span className="flex-1">{r.title}</span>
                <span className="text-[11px] text-muted-foreground">{r.source}</span>
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      <Button onClick={finish} disabled={busy} className="w-full glow-purple gap-2">
        <CheckCircle2 className="h-4 w-4" /> {busy ? "Saving…" : "Mark lesson complete"}
      </Button>

      <AiTutor lessonId={l.id} lessonTitle={l.title} />
    </div>
  );
}

