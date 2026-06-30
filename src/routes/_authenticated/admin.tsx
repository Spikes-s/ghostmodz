import { createFileRoute, Outlet, Link, redirect, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, KeyRound, Inbox, Settings, Wrench, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .eq("role", "administrator")
      .maybeSingle();
    if (!data) throw redirect({ to: "/" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/admin/users", label: "Users", icon: Users, exact: false },
    { to: "/admin/tokens", label: "Access Tokens", icon: KeyRound, exact: false },
    { to: "/admin/requests", label: "Requests", icon: Inbox, exact: false },
    { to: "/admin/settings", label: "Settings", icon: Settings, exact: false },
    { to: "/admin/services", label: "Services", icon: Wrench, exact: false },
    { to: "/admin/payments", label: "Payments", icon: CreditCard, exact: false },
  ];
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text">Admin Console</h1>
          <p className="text-sm text-muted-foreground">Ghost Mods Tech — Operator Panel</p>
        </div>
      </div>
      <nav className="glass rounded-lg p-1 inline-flex gap-1 mb-6 flex-wrap">
        {tabs.map((t) => {
          const active = t.exact ? path === t.to : path.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-primary/20 text-primary neon-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
