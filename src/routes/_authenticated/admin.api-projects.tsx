import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAllApiProjects } from "@/lib/api-projects.functions";
import { Code2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/api-projects")({
  component: AdminApiProjects,
});

function AdminApiProjects() {
  const fn = useServerFn(listAllApiProjects);
  const { data = [] } = useQuery({ queryKey: ["admin-api-projects"], queryFn: () => fn() });
  return (
    <Card className="glass-card border-border/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Code2 className="h-5 w-5 text-primary" /> API Projects ({(data as any[]).length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(data as any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">No API projects yet.</p>
        ) : (
          <div className="divide-y divide-border/40">
            {(data as any[]).map((p) => (
              <div key={p.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.api_type} · {p.auth_type} · {p.status} ·{" "}
                    {p.profile?.email || p.user_id.slice(0, 8)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(p.updated_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
