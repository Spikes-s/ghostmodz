import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { GraduationCap, Users, Award, Flame } from "lucide-react";
import { adminAcademyOverview, setCoursePublished } from "@/lib/academy.functions";

export const Route = createFileRoute("/_authenticated/admin/academy")({
  component: AdminAcademy,
});

function AdminAcademy() {
  const fn = useServerFn(adminAcademyOverview);
  const publishFn = useServerFn(setCoursePublished);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-academy"], queryFn: () => fn() });
  const [q, setQ] = useState("");

  const courses = (data?.courses ?? []) as any[];
  const enrollments = (data?.enrollments ?? []) as any[];
  const certificates = (data?.certificates ?? []) as any[];
  const progress = (data?.progress ?? []) as any[];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return enrollments;
    return enrollments.filter((e) =>
      [e.profile?.full_name, e.profile?.username, e.profile?.email, e.course?.title]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(needle)),
    );
  }, [enrollments, q]);

  async function togglePublish(id: string, published: boolean) {
    try {
      await publishFn({ data: { id, published } });
      toast.success(published ? "Course published" : "Course unpublished");
      qc.invalidateQueries({ queryKey: ["admin-academy"] });
    } catch (e: any) {
      toast.error(e?.message || "Could not update course");
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading academy data…</p>;

  const activeStudents = new Set(enrollments.map((e) => e.user_id)).size;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat icon={GraduationCap} label="Courses" value={courses.length} />
        <Stat icon={Users} label="Enrollments" value={enrollments.length} />
        <Stat icon={Flame} label="Active students" value={activeStudents} />
        <Stat icon={Award} label="Certificates" value={certificates.length} />
      </div>

      <Card className="glass-card border-border/40">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">Students</CardTitle>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search student or course…"
            className="h-9 max-w-xs"
          />
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">No enrollments found.</p>}
          {filtered.map((e) => {
            const done = progress.filter(
              (p) => p.user_id === e.user_id && p.course_id === e.course_id && p.completed,
            ).length;
            const hasCert = certificates.some((c) => c.user_id === e.user_id && c.course_id === e.course_id);
            return (
              <div key={e.id} className="rounded-lg glass px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {e.profile?.full_name || e.profile?.username || e.profile?.email || "Student"}
                  </span>
                  <span className="text-muted-foreground">{e.course?.title ?? "—"}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      {done} lessons done
                    </Badge>
                    {hasCert && (
                      <Badge className="gap-1 border border-secondary/40 bg-secondary/15 text-secondary">
                        <Award className="h-3 w-3" /> Certified
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground capitalize">
                  {e.experience_level} · {e.hours_per_day}h/day · {e.status}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="text-lg">Course catalog</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {courses.map((c) => {
            const enrolled = enrollments.filter((e) => e.course_id === c.id).length;
            const certs = certificates.filter((x) => x.course_id === c.id).length;
            const rate = enrolled ? Math.round((certs / enrolled) * 100) : 0;
            return (
              <div key={c.id} className="space-y-2 rounded-lg glass px-3 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.title}</span>
                  <Badge variant="outline" className="capitalize text-[10px]">
                    {c.track}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{enrolled} enrolled</span>
                  <span>·</span>
                  <span>{certs} certified</span>
                </div>
                <Progress value={rate} className="h-1.5" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {c.published ? "Published" : "Hidden from students"}
                  </span>
                  <Switch
                    checked={!!c.published}
                    onCheckedChange={(v) => togglePublish(c.id, v)}
                    aria-label={`Publish ${c.title}`}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="text-lg">Recent certificates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {certificates.length === 0 && <p className="text-sm text-muted-foreground">None issued yet.</p>}
          {certificates.slice(0, 20).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg glass px-3 py-2 text-sm">
              <span className="font-medium">{c.student_name}</span>
              <span className="text-muted-foreground">{c.course_title}</span>
              <span className="font-mono text-xs text-secondary">{c.certificate_code}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
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
