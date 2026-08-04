import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap, ShieldCheck, Code2 } from "lucide-react";
import { listCourses, enrollInCourse, generateStudyPlan, getRoadmap } from "@/lib/academy.functions";
import { BrandedLoader } from "@/components/ghost/BrandedLoader";

export const Route = createFileRoute("/_authenticated/academy/courses")({
  head: () => ({
    meta: [
      { title: "Learning Paths — Ghost Modz Academy" },
      {
        name: "description",
        content:
          "Pick a coding or cybersecurity learning path and get a personalized roadmap with an adaptive study timetable.",
      },
      { property: "og:title", content: "Learning Paths — Ghost Modz Academy" },
      { property: "og:description", content: "19 coding paths plus a defensive cybersecurity curriculum." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoursesPage,
});

const DAYS = [
  ["mon", "Mon"],
  ["tue", "Tue"],
  ["wed", "Wed"],
  ["thu", "Thu"],
  ["fri", "Fri"],
  ["sat", "Sat"],
  ["sun", "Sun"],
];

function CoursesPage() {
  const listFn = useServerFn(listCourses);
  const enrollFn = useServerFn(enrollInCourse);
  const planFn = useServerFn(generateStudyPlan);
  const roadmapFn = useServerFn(getRoadmap);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({ queryKey: ["academy-courses"], queryFn: () => listFn() });
  const [active, setActive] = useState<any | null>(null);
  const [hours, setHours] = useState(2);
  const [days, setDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [level, setLevel] = useState<"beginner" | "some" | "intermediate" | "advanced">("beginner");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoading) return <BrandedLoader label="Loading learning paths…" />;

  const courses = (data ?? []) as any[];
  const coding = courses.filter((c) => c.track === "coding");
  const security = courses.filter((c) => c.track === "cybersecurity");

  async function submit() {
    if (!active) return;
    setBusy(true);
    try {
      const res: any = await enrollFn({
        data: {
          course_id: active.id,
          hours_per_day: hours,
          study_days: days,
          experience_level: level,
          target_completion: target || null,
        },
      });
      toast.success("Enrolled", { description: "Building your roadmap…" });
      await roadmapFn({ data: { slug: active.slug } });
      await planFn({ data: { enrollment_id: res.enrollment.id } }).catch(() => {});
      navigate({ to: "/academy/$slug", params: { slug: active.slug } });
    } catch (e: any) {
      toast.error(e?.message || "Enrollment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Button variant="ghost" size="sm" className="mb-4 gap-2" onClick={() => navigate({ to: "/academy" })}>
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Button>
      <p className="font-mono text-xs tracking-[0.3em] text-primary">// CHOOSE YOUR PATH</p>
      <h1 className="text-3xl md:text-4xl font-bold neon-text mb-2">Learning paths</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Every path has a beginner → expert roadmap with lessons, exercises, quizzes and projects.
      </p>

      <Section icon={Code2} title="Coding" courses={coding} onPick={setActive} />
      <Section icon={ShieldCheck} title="Cybersecurity" courses={security} onPick={setActive} />

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="glass-card border-primary/40 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" /> Enroll in {active?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label>Hours available per day: {hours}h</Label>
              <Slider
                value={[hours]}
                min={0.5}
                max={8}
                step={0.5}
                onValueChange={(v) => setHours(v[0])}
                className="mt-3"
              />
            </div>
            <div>
              <Label>Preferred study days</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAYS.map(([k, l]) => {
                  const on = days.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setDays((d) => (on ? d.filter((x) => x !== k) : [...d, k]))}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        on ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground"
                      }`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Experience level</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ["beginner", "Complete beginner"],
                    ["some", "Some exposure"],
                    ["intermediate", "Intermediate"],
                    ["advanced", "Advanced"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setLevel(k)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      level === k ? "border-primary bg-primary/15 text-primary" : "border-border/50"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Target completion date (optional)</Label>
              <Input type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
            <Button onClick={submit} disabled={busy || !days.length} className="w-full glow-purple">
              {busy ? "Generating your roadmap…" : "Start learning"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  courses,
  onPick,
}: {
  icon: any;
  title: string;
  courses: any[];
  onPick: (c: any) => void;
}) {
  if (!courses.length) return null;
  return (
    <div className="mb-10">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
        <Icon className="h-5 w-5 text-secondary" /> {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <Card
            key={c.id}
            onClick={() => onPick(c)}
            className="glass-card border-border/40 cursor-pointer transition-all hover:border-primary/60 hover:shadow-[0_0_24px_-8px_hsl(var(--primary))]"
          >
            <CardContent className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-lg font-semibold">{c.title}</h3>
                <Badge variant="outline" className="capitalize border-primary/40 text-primary text-[10px]">
                  {c.difficulty}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{c.tagline || c.description}</p>
              <p className="mt-3 font-mono text-[11px] text-secondary">~{c.estimated_hours}h curriculum</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
