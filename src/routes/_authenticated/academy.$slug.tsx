import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { getRoadmap } from "@/lib/academy.functions";
import { BrandedLoader } from "@/components/ghost/BrandedLoader";

export const Route = createFileRoute("/_authenticated/academy/$slug")({
  head: () => ({
    meta: [
      { title: "Course Roadmap — Ghost Modz Academy" },
      { name: "description", content: "Your structured beginner to expert roadmap with lessons, quizzes and projects." },
      { property: "og:title", content: "Course Roadmap — Ghost Modz Academy" },
      { property: "og:description", content: "Beginner to expert curriculum with lessons, quizzes and projects." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoadmapPage,
});

const LEVEL_ORDER = ["beginner", "intermediate", "advanced", "expert"];

function RoadmapPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const fn = useServerFn(getRoadmap);
  const { data, isLoading } = useQuery({
    queryKey: ["roadmap", slug],
    queryFn: () => fn({ data: { slug } }),
  });

  if (isLoading) return <BrandedLoader label="Assembling your roadmap…" />;
  if (!data) return <div className="p-10 text-center text-muted-foreground">Course not found.</div>;

  const course = data.course as any;
  const modules = (data.modules ?? []) as any[];
  const progress = (data.progress ?? []) as any[];
  const done = new Set(progress.filter((p) => p.completed).map((p) => p.lesson_id));
  const allLessons = modules.flatMap((m) => m.lessons ?? []);
  const pct = allLessons.length ? Math.round(([...done].filter((id) => allLessons.some((l: any) => l.id === id)).length / allLessons.length) * 100) : 0;

  const byLevel = LEVEL_ORDER.map((lvl) => ({
    level: lvl,
    modules: modules.filter((m) => m.level === lvl).sort((a, b) => a.sort_order - b.sort_order),
  })).filter((g) => g.modules.length);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Button variant="ghost" size="sm" className="mb-4 gap-2" onClick={() => navigate({ to: "/academy" })}>
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Button>

      <div className="mb-8">
        <p className="font-mono text-xs tracking-[0.3em] text-primary">// LEARNING ROADMAP</p>
        <h1 className="text-3xl md:text-4xl font-bold neon-text">{course.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{course.description}</p>
        <div className="mt-4 flex items-center gap-3">
          <Progress value={pct} className="h-2 flex-1" />
          <span className="text-sm font-mono text-secondary">{pct}%</span>
        </div>
        {pct === 100 && (
          <Button
            onClick={claim}
            disabled={claiming}
            className="mt-4 gap-2 glow-purple"
          >
            <Award className="h-4 w-4" /> {claiming ? "Issuing…" : "View your certificate"}
          </Button>
        )}
      </div>


      <div className="space-y-8">
        {byLevel.map((group) => (
          <div key={group.level}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold capitalize">
              <Badge className="bg-primary/15 text-primary border border-primary/40 capitalize">{group.level}</Badge>
            </h2>
            <Accordion type="multiple" className="space-y-3">
              {group.modules.map((m) => {
                const lessons = (m.lessons ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order);
                const modDone = lessons.filter((l: any) => done.has(l.id)).length;
                return (
                  <AccordionItem key={m.id} value={m.id} className="glass-card rounded-xl border-border/40 px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-1 items-center justify-between pr-3 text-left">
                        <div>
                          <p className="font-medium">{m.title}</p>
                          <p className="text-xs text-muted-foreground">{m.summary}</p>
                        </div>
                        <span className="font-mono text-xs text-secondary">
                          {modDone}/{lessons.length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1 pb-2">
                        {lessons.map((l: any) => {
                          const isDone = done.has(l.id);
                          return (
                            <button
                              key={l.id}
                              onClick={() =>
                                navigate({ to: "/academy/lesson/$lessonId", params: { lessonId: l.id } })
                              }
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10"
                            >
                              {isDone ? (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="flex-1">{l.title}</span>
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {l.estimated_minutes}m
                              </span>
                              <PlayCircle className="h-4 w-4 text-secondary" />
                            </button>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        ))}
      </div>

      {modules.length === 0 && (
        <Card className="glass-card border-border/40">
          <CardContent className="p-10 text-center text-muted-foreground">
            Roadmap is being generated. Refresh in a moment.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
