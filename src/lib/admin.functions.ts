import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ROLES = ["administrator", "moderator", "premium", "standard"] as const;

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "administrator")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: administrator role required");
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "administrator",
    });
    return { isAdmin: !!data, userId: context.userId };
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [users, newUsers7d, activeUsers24h, projects, conversations, messages, logins24h] =
      await Promise.all([
        admin.from("profiles").select("id", { count: "exact", head: true }),
        admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since7d),
        admin.from("login_history").select("user_id", { count: "exact", head: true }).gte("created_at", since24h),
        admin.from("projects").select("id", { count: "exact", head: true }),
        admin.from("conversations").select("id", { count: "exact", head: true }),
        admin.from("messages").select("id", { count: "exact", head: true }),
        admin.from("login_history").select("id", { count: "exact", head: true }).gte("created_at", since24h),
      ]);

    const { data: recent } = await admin
      .from("login_history")
      .select("id,user_id,ip_address,user_agent,created_at")
      .order("created_at", { ascending: false })
      .limit(15);

    const recentIds = [...new Set((recent ?? []).map((r) => r.user_id))];
    const { data: recentProfiles } = recentIds.length
      ? await admin.from("profiles").select("id,email,username").in("id", recentIds)
      : { data: [] as any[] };
    const profileMap = new Map((recentProfiles ?? []).map((p: any) => [p.id, p]));

    return {
      totalUsers: users.count ?? 0,
      newUsers7d: newUsers7d.count ?? 0,
      activeUsers24h: activeUsers24h.count ?? 0,
      totalProjects: projects.count ?? 0,
      totalConversations: conversations.count ?? 0,
      totalMessages: messages.count ?? 0,
      logins24h: logins24h.count ?? 0,
      recentActivity: (recent ?? []).map((r) => ({
        ...r,
        profile: profileMap.get(r.user_id) ?? null,
      })),
    };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ search: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();

    let q = admin
      .from("profiles")
      .select("id,email,username,full_name,avatar_url,suspended,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.search && data.search.trim()) {
      const s = `%${data.search.trim()}%`;
      q = q.or(`email.ilike.${s},username.ilike.${s},full_name.ilike.${s}`);
    }

    const { data: profiles, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.id);
    const { data: roles } = ids.length
      ? await admin.from("user_roles").select("user_id,role").in("user_id", ids)
      : { data: [] as any[] };

    const rolesByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });

    return (profiles ?? []).map((p) => ({
      ...p,
      roles: rolesByUser.get(p.id) ?? [],
    }));
  });

export const getUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const [{ data: profile }, { data: roles }, { data: logins }] = await Promise.all([
      admin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", data.userId),
      admin
        .from("login_history")
        .select("id,ip_address,user_agent,created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return {
      profile,
      roles: (roles ?? []).map((r: any) => r.role),
      loginHistory: logins ?? [],
    };
  });

export const setUserSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), suspended: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { error } = await admin
      .from("profiles")
      .update({ suspended: data.suspended })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    if (data.suspended) {
      // sign out all sessions
      try {
        await admin.auth.admin.signOut(data.userId);
      } catch {
        /* ignore */
      }
    }
    return { ok: true };
  });

export const assignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), role: z.enum(ROLES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { error } = await admin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const removeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), role: z.enum(ROLES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.role === "administrator") {
      throw new Error("You cannot remove your own administrator role.");
    }
    const admin = await getAdmin();
    const { error } = await admin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own account from the admin panel.");
    }
    const admin = await getAdmin();
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("login_history")
      .insert({ user_id: context.userId, user_agent: "web" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
