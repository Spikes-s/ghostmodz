import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  Flame,
  Clock,
  Award,
  Trophy,
  BookOpen,
  ArrowRight,
  Bot,
  CalendarDays,
  PlayCircle,

} from "lucide-react";
import { getAcademyOverview, getMyPlan, markWelcomed } from "@/lib/academy.functions";
import { AcademyWelcome } from "@/components/ghost/AcademyWelcome";
import { BrandedLoader } from "@/components/ghost/BrandedLoader";

export const Route = createFileRoute("/_authenticated/academy/")({
  head: () => ({
    meta: [
      { title: "Ghost Modz Academy — Student Dashboard" },
      {
        name: "description",
        content:
          "Your Ghost Modz Academy dashboard: courses, roadmap progress, streaks, achievements and certificates.",
      },
      { property: "og:title", content: "Ghost Modz Academy — Student Dashboard" },
      { property: "og:description", content: "Track your learning path, streak, achievements and certificates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AcademyDashboard,
});

function AcademyDashboard() {
  const overviewFn = useServerFn(getAcademyOverview);
  const planFn = useServerFn(getMyPlan);
  const welcomedFn = useServerFn(markWelcomed);
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery({ queryKey: ["academy-overview"], queryFn: () => overviewFn() });
  const { data: plan } = useQuery({ queryKey: ["academy-plan"], queryFn: () => planFn() });
  const [showWelcome, setShowWelcome] = useState(false);

  const enrollments = (data?.enrollments ?? []) as any[];
  const needsWelcome = enrollments.some((e) => !e.welcomed);

  useEffect(() => {
    if (needsWelcome) setShowWelcome(true);
  }, [needsWelcome]);

  const dismiss = useCallback(() => {
    setShowWelcome(false);
    welcomedFn().then(() => refetch());
  }, [welcomedFn, refetch]);

  if (isLoading) return <BrandedLoader label="Loading academy…" />;

  const progress = (data?.progress ?? []) as any[];
  const totals = (data?.totals ?? {}) as Record<string, number>;
  const next = (data?.next ?? {}) as Record<string, any>;
  const achievements = (data?.achievements ?? []) as any[];
  const certificates = (data?.certificates ?? []) as any[];

  if (!enrollments.length) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-2xl glass neon-border">
          <GraduationCap className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold neon-text">Ghost Modz Academy</h1>
        <p className="mt-3 text-muted-foreground">
          You're not enrolled in a learning path yet. Choose a course and we'll build your personalized roadmap and
          study timetable.
        </p>
        <Button asChild className="mt-6 glow-purple gap-2">
          <Link to="/academy/courses">
            Choose a learning path <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  const totalDone = progress.filter((p) => p.completed).length;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {showWelcome && <AcademyWelcome onDone={dismiss} />}

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-primary">// GHOST MODZ ACADEMY</p>
          <h1 className="text-3xl md:text-4xl font-bold neon-text">Welcome back, operator</h1>
          <p className="text-sm text-muted-foreground">Keep the streak alive — every lesson compounds.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/academy/courses">
              <BookOpen className="h-4 w-4" /> Browse paths
            </Link>
          </Button>
          <Button asChild className="glow-purple gap-2">
            <Link to="/spikes">
              <Bot className="h-4 w-4" /> AI Tutor
            </Link>
          </Button>
        </div>
      </div>

      {(data as any)?.resume && (
        <Card className="glass-card border-secondary/40 mb-8">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-mono text-[11px] tracking-[0.25em] text-secondary">// PICK UP WHERE YOU LEFT OFF</p>
              <h2 className="mt-1 text-lg font-semibold">{(data as any).resume.lesson_title}</h2>
              <p className="text-sm text-muted-foreground">
                {(data as any).resume.course_title}
                {(data as any).resume.minutes_spent > 0
                  ? ` · ${(data as any).resume.minutes_spent} min logged`
                  : ""}
              </p>
            </div>
            <Button
              className="glow-purple gap-2"
              onClick={() =>
                navigate({
                  to: "/academy/lesson/$lessonId",
                  params: { lessonId: (data as any).resume.lesson_id },
                })
              }
            >
              <PlayCircle className="h-4 w-4" /> Resume lesson
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">

        <Stat icon={Flame} label="Learning streak" value={`${data?.streak ?? 0} days`} />
        <Stat icon={Clock} label="Time invested" value={`${Math.round((data?.minutesTotal ?? 0) / 60)} h`} />
        <Stat icon={Trophy} label="Lessons completed" value={String(totalDone)} />
        <Stat icon={Award} label="Certificates" value={String(certificates.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {enrollments.map((e) => {
            const total = totals[e.course_id] ?? 0;
            const done = progress.filter((p) => p.course_id === e.course_id && p.completed).length;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const nx = next[e.course_id];
            return (
              <Card key={e.id} className="glass-card border-primary/30">
                <CardHeader className="flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">{e.course?.title ?? "Course"}</CardTitle>
                    <p className="text-xs text-muted-foreground capitalize">
                      {e.track} · {e.experience_level} · {e.hours_per_day}h/day
                    </p>
                  </div>
                  <Badge variant="outline" className="border-primary/50 text-primary">
                    {pct}%
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={pct} className="h-2" />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Next lesson: </span>
                      <span className="font-medium">{nx?.title ?? "Roadmap ready to generate"}</span>
                    </div>
                    <Button
                      onClick={() => navigate({ to: "/academy/$slug", params: { slug: e.course?.slug ?? "" } })}
                      className="gap-2 glow-purple"
                      size="sm"
                    >
                      Continue learning <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-6">
          <Card className="glass-card border-border/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-secondary" /> Upcoming sessions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(plan ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Your timetable appears once your roadmap is generated.</p>
              )}
              {((plan ?? []) as any[]).slice(0, 6).map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg glass px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-secondary">{d.scheduled_for}</span>
                  <span className="text-muted-foreground">
                    {(d.lesson_ids?.length ?? 0)} lessons · {d.minutes}m
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-primary" /> Achievements
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {achievements.length === 0 && (
                <p className="text-sm text-muted-foreground">No badges yet — finish a lesson to earn your first.</p>
              )}
              {achievements.map((a) => (
                <Badge key={a.id} className="bg-primary/15 text-primary border border-primary/40">
                  {a.title}
                </Badge>
              ))}
            </CardContent>
          </Card>

          {certificates.length > 0 && (
            <Card className="glass-card border-border/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="h-4 w-4 text-secondary" /> Certificates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {certificates.map((c) => (
                  <Link
                    key={c.id}
                    to="/academy/certificate/$code"
                    params={{ code: c.certificate_code }}
                    className="block rounded-lg glass px-3 py-2 text-sm hover:border-primary/60 border border-transparent"
                  >
                    {c.course_title} · <span className="font-mono text-xs text-secondary">{c.certificate_code}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card className="glass-card border-border/40">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
