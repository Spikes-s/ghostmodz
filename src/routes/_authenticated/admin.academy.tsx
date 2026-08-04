import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Users, Award } from "lucide-react";
import { adminAcademyOverview } from "@/lib/academy.functions";

export const Route = createFileRoute("/_authenticated/admin/academy")({
  component: AdminAcademy,
});

function AdminAcademy() {
  const fn = useServerFn(adminAcademyOverview);
  const { data, isLoading } = useQuery({ queryKey: ["admin-academy"], queryFn: () => fn() });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading academy data…</p>;

  const courses = (data?.courses ?? []) as any[];
  const enrollments = (data?.enrollments ?? []) as any[];
  const certificates = (data?.certificates ?? []) as any[];
  const progress = (data?.progress ?? []) as any[];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={GraduationCap} label="Courses" value={courses.length} />
        <Stat icon={Users} label="Enrollments" value={enrollments.length} />
        <Stat icon={Award} label="Certificates issued" value={certificates.length} />
      </div>

      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="text-lg">Students</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {enrollments.length === 0 && <p className="text-sm text-muted-foreground">No enrollments yet.</p>}
          {enrollments.map((e) => {
            const done = progress.filter(
              (p) => p.user_id === e.user_id && p.course_id === e.course_id && p.completed,
            ).length;
            return (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg glass px-3 py-2 text-sm"
              >
                <span className="font-medium">
                  {e.profile?.full_name || e.profile?.username || e.profile?.email || "Student"}
                </span>
                <span className="text-muted-foreground">{e.course?.title ?? "—"}</span>
                <Badge variant="outline" className="border-primary/40 text-primary">
                  {done} lessons done
                </Badge>
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
          {courses.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg glass px-3 py-2 text-sm">
              <span>{c.title}</span>
              <Badge variant="outline" className="capitalize text-[10px]">
                {c.track}
              </Badge>
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
