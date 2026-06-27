import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, Activity, FolderKanban, MessageSquare, Bot, LogIn } from "lucide-react";
import { getDashboardStats } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function StatCard({
  label,
  value,
  Icon,
  hint,
}: {
  label: string;
  value: number | string;
  Icon: any;
  hint?: string;
}) {
  return (
    <Card className="glass-card border-border/40">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold neon-text">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function AdminDashboard() {
  const fn = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fn(),
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={data.totalUsers} Icon={Users} />
        <StatCard
          label="New (7d)"
          value={data.newUsers7d}
          Icon={UserPlus}
          hint="New registrations"
        />
        <StatCard
          label="Active (24h)"
          value={data.activeUsers24h}
          Icon={Activity}
          hint="Distinct logins"
        />
        <StatCard label="Logins (24h)" value={data.logins24h} Icon={LogIn} />
        <StatCard label="Projects" value={data.totalProjects} Icon={FolderKanban} />
        <StatCard label="Conversations" value={data.totalConversations} Icon={MessageSquare} />
        <StatCard label="AI Messages" value={data.totalMessages} Icon={Bot} hint="Total exchanges" />
        <StatCard
          label="Avg msgs / chat"
          value={
            data.totalConversations
              ? (data.totalMessages / data.totalConversations).toFixed(1)
              : "0"
          }
          Icon={Bot}
        />
      </div>

      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent sign-ins yet.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {data.recentActivity.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <LogIn className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-medium">
                        {r.profile?.username || r.profile?.email || r.user_id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.profile?.email}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
