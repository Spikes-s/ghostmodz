import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ShieldOff, ShieldCheck, Trash2, UserCog, History, X } from "lucide-react";
import { toast } from "sonner";
import {
  listUsers,
  setUserSuspended,
  assignRole,
  removeRole,
  deleteUser,
  getUserDetail,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

const ROLES = ["administrator", "moderator", "premium", "standard"] as const;

function roleColor(r: string) {
  switch (r) {
    case "administrator":
      return "bg-red-500/20 text-red-300 border-red-500/40";
    case "moderator":
      return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    case "premium":
      return "bg-violet-500/20 text-violet-300 border-violet-500/40";
    default:
      return "bg-blue-500/20 text-blue-300 border-blue-500/40";
  }
}

function UsersPage() {
  const qc = useQueryClient();
  const list = useServerFn(listUsers);
  const suspend = useServerFn(setUserSuspended);
  const assign = useServerFn(assignRole);
  const remove = useServerFn(removeRole);
  const del = useServerFn(deleteUser);
  const detail = useServerFn(getUserDetail);

  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", activeSearch],
    queryFn: () => list({ data: { search: activeSearch } }),
  });

  const detailQuery = useQuery({
    queryKey: ["admin-user-detail", detailUserId],
    queryFn: () => detail({ data: { userId: detailUserId! } }),
    enabled: !!detailUserId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const suspendMut = useMutation({
    mutationFn: (v: { userId: string; suspended: boolean }) => suspend({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.suspended ? "Account suspended" : "Account restored");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const assignMut = useMutation({
    mutationFn: (v: { userId: string; role: any }) => assign({ data: v }),
    onSuccess: () => {
      toast.success("Role assigned");
      invalidate();
      if (detailUserId) qc.invalidateQueries({ queryKey: ["admin-user-detail", detailUserId] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const removeMut = useMutation({
    mutationFn: (v: { userId: string; role: any }) => remove({ data: v }),
    onSuccess: () => {
      toast.success("Role removed");
      invalidate();
      if (detailUserId) qc.invalidateQueries({ queryKey: ["admin-user-detail", detailUserId] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (userId: string) => del({ data: { userId } }),
    onSuccess: () => {
      toast.success("User deleted");
      setDetailUserId(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="glass-card border-border/40">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>User Management</span>
          <span className="text-xs text-muted-foreground font-normal">
            {users?.length ?? 0} shown
          </span>
        </CardTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setActiveSearch(search);
          }}
          className="flex gap-2 pt-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email, username, name…"
              className="pl-9 bg-background/40"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {activeSearch && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setActiveSearch("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </form>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !users?.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No users found.</p>
        ) : (
          <div className="divide-y divide-border/40">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">
                      {u.username || u.full_name || u.email}
                    </span>
                    {u.suspended && (
                      <Badge variant="destructive" className="text-[10px]">
                        Suspended
                      </Badge>
                    )}
                    {u.roles.map((r) => (
                      <span
                        key={r}
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${roleColor(r)}`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDetailUserId(u.id)}
                  >
                    <UserCog className="h-4 w-4 mr-1" /> Manage
                  </Button>
                  <Button
                    size="sm"
                    variant={u.suspended ? "secondary" : "outline"}
                    onClick={() =>
                      suspendMut.mutate({ userId: u.id, suspended: !u.suspended })
                    }
                  >
                    {u.suspended ? (
                      <>
                        <ShieldCheck className="h-4 w-4 mr-1" /> Restore
                      </>
                    ) : (
                      <>
                        <ShieldOff className="h-4 w-4 mr-1" /> Suspend
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!detailUserId} onOpenChange={(o) => !o && setDetailUserId(null)}>
        <DialogContent className="glass-card border-border/40 max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {!detailQuery.data ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-2">Profile</h3>
                <div className="text-sm space-y-1">
                  <div><span className="text-muted-foreground">Email:</span> {detailQuery.data.profile?.email}</div>
                  <div><span className="text-muted-foreground">Username:</span> {detailQuery.data.profile?.username || "—"}</div>
                  <div><span className="text-muted-foreground">Name:</span> {detailQuery.data.profile?.full_name || "—"}</div>
                  <div><span className="text-muted-foreground">Joined:</span> {new Date(detailQuery.data.profile?.created_at).toLocaleString()}</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Roles</h3>
                <div className="flex flex-wrap gap-2 mb-2">
                  {detailQuery.data.roles.length === 0 && (
                    <span className="text-xs text-muted-foreground">No roles assigned</span>
                  )}
                  {detailQuery.data.roles.map((r) => (
                    <span
                      key={r}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${roleColor(r)}`}
                    >
                      {r}
                      <button
                        onClick={() => removeMut.mutate({ userId: detailUserId!, role: r as any })}
                        className="hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Select
                    onValueChange={(v) =>
                      assignMut.mutate({ userId: detailUserId!, role: v as any })
                    }
                  >
                    <SelectTrigger className="w-48 bg-background/40">
                      <SelectValue placeholder="Assign role…" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.filter((r) => !detailQuery.data!.roles.includes(r)).map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <History className="h-4 w-4" /> Login History
                </h3>
                {detailQuery.data.loginHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No recorded logins.</p>
                ) : (
                  <div className="text-xs space-y-1 max-h-60 overflow-y-auto">
                    {detailQuery.data.loginHistory.map((l) => (
                      <div key={l.id} className="flex justify-between border-b border-border/30 py-1">
                        <span>{l.user_agent || "—"}</span>
                        <span className="text-muted-foreground">
                          {new Date(l.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-border/40">
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Permanently delete this user? This cannot be undone.")) {
                      deleteMut.mutate(detailUserId!);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Account
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
