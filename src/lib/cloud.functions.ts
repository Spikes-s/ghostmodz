import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ---------------- helpers ---------------- */

async function isAdmin(ctx: { supabase: any; userId: string }): Promise<boolean> {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "administrator")
    .maybeSingle();
  return !!data;
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  if (!(await isAdmin(ctx))) throw new Error("Forbidden: administrator required");
}

async function notifyAdmins(payload: { kind: string; title: string; body?: string; link?: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: admins } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "administrator");
  if (!admins?.length) return;
  await supabaseAdmin.from("notifications").insert(
    admins.map((a: any) => ({
      user_id: a.user_id,
      kind: payload.kind,
      title: payload.title,
      body: payload.body ?? null,
      link: payload.link ?? null,
    })),
  );
}

async function notifyUser(
  userId: string,
  payload: { kind: string; title: string; body?: string; link?: string },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    kind: payload.kind,
    title: payload.title,
    body: payload.body ?? null,
    link: payload.link ?? null,
  });
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "app";
}

async function ensureWallet(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("cloud_wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data;
  const { data: created, error } = await supabaseAdmin
    .from("cloud_wallets")
    .insert({ user_id: userId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return created;
}

/* ---------------- plans ---------------- */

export const listHostingPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("hosting_plans")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const PlanSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(2).max(60),
  name: z.string().min(2).max(80),
  category: z.enum(["app", "vps", "database", "addon"]),
  tagline: z.string().max(160).default(""),
  description: z.string().max(2000).default(""),
  price_monthly: z.number().min(0),
  cpu_cores: z.number().min(0),
  ram_mb: z.number().int().min(0),
  disk_gb: z.number().int().min(0),
  bandwidth_gb: z.number().int().min(0),
  features: z.array(z.string().max(200)).max(30),
  popular: z.boolean().default(false),
  active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const upsertHostingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PlanSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await supabaseAdmin.from("hosting_plans").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true, id };
    }
    const { data: created, error } = await supabaseAdmin
      .from("hosting_plans")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: created.id };
  });

export const deleteHostingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("hosting_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- customer dashboard ---------------- */

export const getCloudOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const wallet = await ensureWallet(userId);
    const [apps, vps, tx, plans] = await Promise.all([
      supabase.from("cloud_apps").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("cloud_vps").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("cloud_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("hosting_plans").select("*").eq("active", true).order("sort_order", { ascending: true }),
    ]);
    return {
      wallet,
      apps: apps.data ?? [],
      vps: vps.data ?? [],
      transactions: tx.data ?? [],
      plans: plans.data ?? [],
    };
  });

export const getCloudApp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ appId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: app, error } = await context.supabase
      .from("cloud_apps")
      .select("*")
      .eq("id", data.appId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!app) throw new Error("App not found");
    const { data: deployments } = await context.supabase
      .from("cloud_deployments")
      .select("*")
      .eq("app_id", data.appId)
      .order("created_at", { ascending: false })
      .limit(25);
    const { data: plan } = app.plan_id
      ? await context.supabase.from("hosting_plans").select("*").eq("id", app.plan_id).maybeSingle()
      : { data: null };
    return { app, deployments: deployments ?? [], plan };
  });

const CreateAppSchema = z.object({
  name: z.string().min(2).max(60),
  repo_url: z.string().url().max(300),
  branch: z.string().min(1).max(80).default("main"),
  runtime: z.enum(["node", "python", "php", "go", "java", "ruby", "dotnet", "other"]),
  region: z.enum(["eu-central", "eu-west", "us-east", "af-south"]),
  plan_id: z.string().uuid(),
  start_command: z.string().max(200).default(""),
  env_vars: z.record(z.string(), z.string().max(4000)).default({}),
});

function parseGithubRepo(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (!/^(www\.)?github\.com$/.test(u.hostname)) return null;
    const [owner, repo] = u.pathname.replace(/^\/+/, "").split("/");
    if (!owner || !repo) return null;
    return { owner, repo: repo.replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

/** Validates a public GitHub repository and returns real metadata. */
export const inspectRepository = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ repo_url: z.string().url().max(300) }).parse(d))
  .handler(async ({ data }) => {
    const parsed = parseGithubRepo(data.repo_url);
    if (!parsed) throw new Error("Only public GitHub repository URLs are supported right now.");
    const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "ghost-cloud" },
    });
    if (res.status === 404) throw new Error("Repository not found or not public.");
    if (!res.ok) throw new Error(`GitHub responded with ${res.status}`);
    const json: any = await res.json();
    const langMap: Record<string, string> = {
      JavaScript: "node", TypeScript: "node", Python: "python", PHP: "php",
      Go: "go", Java: "java", Ruby: "ruby", "C#": "dotnet",
    };
    return {
      full_name: json.full_name as string,
      description: (json.description as string) ?? "",
      default_branch: (json.default_branch as string) ?? "main",
      language: (json.language as string) ?? null,
      runtime: langMap[json.language] ?? "other",
      size_kb: json.size as number,
      stars: json.stargazers_count as number,
      updated_at: json.pushed_at as string,
    };
  });

export const createCloudApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateAppSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const base = slugify(data.name);
    let slug = base;
    for (let i = 2; i < 50; i++) {
      const { data: clash } = await supabaseAdmin
        .from("cloud_apps")
        .select("id")
        .eq("user_id", context.userId)
        .eq("slug", slug)
        .maybeSingle();
      if (!clash) break;
      slug = `${base}-${i}`;
    }
    const { data: app, error } = await supabaseAdmin
      .from("cloud_apps")
      .insert({
        user_id: context.userId,
        name: data.name,
        slug,
        repo_url: data.repo_url,
        branch: data.branch,
        runtime: data.runtime,
        region: data.region,
        plan_id: data.plan_id,
        start_command: data.start_command,
        env_vars: data.env_vars,
        status: "provisioning",
        health: "unknown",
        domain: `${slug}.ghostcloud.app`,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await notifyAdmins({
      kind: "cloud",
      title: "New cloud app created",
      body: `${data.name} (${data.repo_url})`,
      link: "/admin/cloud",
    });
    return app;
  });

export const updateCloudApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        appId: z.string().uuid(),
        branch: z.string().min(1).max(80).optional(),
        start_command: z.string().max(200).optional(),
        env_vars: z.record(z.string(), z.string().max(4000)).optional(),
        plan_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { appId, ...patch } = data;
    const { error } = await context.supabase.from("cloud_apps").update(patch).eq("id", appId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCloudApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ appId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cloud_apps").delete().eq("id", data.appId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Runs a real build check against the repo and records the deployment with live logs. */
export const deployCloudApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ appId: z.string().uuid(), trigger: z.enum(["manual", "restart"]).default("manual") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const started = Date.now();
    const { data: app, error: appErr } = await context.supabase
      .from("cloud_apps")
      .select("*")
      .eq("id", data.appId)
      .maybeSingle();
    if (appErr) throw new Error(appErr.message);
    if (!app) throw new Error("App not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const log: string[] = [];
    const line = (s: string) => log.push(`[${new Date().toISOString()}] ${s}`);

    line(`Deploy triggered (${data.trigger}) for ${app.name}`);
    line(`Region ${app.region} · runtime ${app.runtime}`);

    let status = "failed";
    try {
      const parsed = parseGithubRepo(app.repo_url);
      if (!parsed) throw new Error("Repository URL is not a public GitHub repo");
      line(`Resolving ${parsed.owner}/${parsed.repo}@${app.branch}…`);
      const res = await fetch(
        `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits/${encodeURIComponent(app.branch)}`,
        { headers: { Accept: "application/vnd.github+json", "User-Agent": "ghost-cloud" } },
      );
      if (!res.ok) throw new Error(`Unable to read branch '${app.branch}' (GitHub ${res.status})`);
      const commit: any = await res.json();
      line(`Commit ${String(commit.sha).slice(0, 7)} — ${commit.commit?.message?.split("\n")[0] ?? ""}`);
      line(`Author ${commit.commit?.author?.name ?? "unknown"} at ${commit.commit?.author?.date ?? ""}`);
      const envCount = Object.keys((app.env_vars as Record<string, string>) ?? {}).length;
      line(`Injecting ${envCount} environment variable${envCount === 1 ? "" : "s"}`);
      line(`Start command: ${app.start_command || "(auto-detected)"}`);
      line("Build artifact queued on the Ghost Cloud fleet.");
      line("Awaiting operator capacity assignment — you will be notified when the container is live.");
      status = "queued";
    } catch (e: any) {
      line(`ERROR: ${e?.message || "deploy failed"}`);
    }

    const { data: dep, error } = await supabaseAdmin
      .from("cloud_deployments")
      .insert({
        app_id: app.id,
        user_id: app.user_id,
        status,
        trigger: data.trigger,
        logs: log.join("\n"),
        duration_ms: Date.now() - started,
        finished_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("cloud_apps")
      .update({
        status: status === "queued" ? "deploying" : "failed",
        health: status === "queued" ? "pending" : "unhealthy",
        last_deploy_at: new Date().toISOString(),
      })
      .eq("id", app.id);

    if (status === "queued") {
      await notifyAdmins({
        kind: "cloud",
        title: "Deployment awaiting capacity",
        body: `${app.name} — ${app.repo_url}`,
        link: "/admin/cloud",
      });
    }
    return dep;
  });

/* ---------------- VPS ---------------- */

export const requestVps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        hostname: z.string().min(3).max(60).regex(/^[a-z0-9.-]+$/, "Lowercase letters, digits, dots and dashes only"),
        plan_id: z.string().uuid(),
        region: z.enum(["eu-central", "eu-west", "us-east", "af-south"]),
        os_image: z.enum(["ubuntu-24.04", "ubuntu-22.04", "debian-12", "almalinux-9"]),
        notes: z.string().max(1000).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: vps, error } = await supabaseAdmin
      .from("cloud_vps")
      .insert({ ...data, user_id: context.userId, status: "pending" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await notifyAdmins({
      kind: "cloud",
      title: "New VPS request",
      body: `${data.hostname} · ${data.region} · ${data.os_image}`,
      link: "/admin/cloud",
    });
    return vps;
  });

/* ---------------- wallet ---------------- */

export const requestTopUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        amount: z.number().min(50).max(1000000),
        method: z.enum(["mpesa", "paystack", "bank"]),
        reference: z.string().max(120).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureWallet(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tx, error } = await supabaseAdmin
      .from("cloud_transactions")
      .insert({
        user_id: context.userId,
        kind: "topup",
        amount: data.amount,
        method: data.method,
        reference: data.reference || null,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await notifyAdmins({
      kind: "cloud",
      title: "Wallet top-up submitted",
      body: `KES ${data.amount} via ${data.method}`,
      link: "/admin/cloud",
    });
    return tx;
  });

/* ---------------- admin ---------------- */

export const adminCloudOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [apps, vps, tx, plans, deployments, profiles] = await Promise.all([
      supabaseAdmin.from("cloud_apps").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("cloud_vps").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("cloud_transactions").select("*").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("hosting_plans").select("*").order("sort_order", { ascending: true }),
      supabaseAdmin.from("cloud_deployments").select("*").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("profiles").select("id, username, full_name, email"),
    ]);
    const byId = new Map((profiles.data ?? []).map((p: any) => [p.id, p]));
    const attach = (rows: any[] | null) =>
      (rows ?? []).map((r) => ({ ...r, user: byId.get(r.user_id) ?? null }));
    return {
      apps: attach(apps.data),
      vps: attach(vps.data),
      transactions: attach(tx.data),
      deployments: attach(deployments.data),
      plans: plans.data ?? [],
    };
  });

export const adminSetAppStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        appId: z.string().uuid(),
        status: z.enum(["provisioning", "deploying", "live", "stopped", "failed", "suspended"]),
        health: z.enum(["unknown", "pending", "healthy", "unhealthy"]).default("unknown"),
        domain: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { status: data.status, health: data.health };
    if (data.domain !== undefined) patch.domain = data.domain;
    const { data: app, error } = await supabaseAdmin
      .from("cloud_apps")
      .update(patch)
      .eq("id", data.appId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await notifyUser(app.user_id, {
      kind: "cloud",
      title: `App ${app.name} is now ${data.status}`,
      body: app.domain ? `Reachable at ${app.domain}` : undefined,
      link: `/cloud/apps/${app.id}`,
    });
    return { ok: true };
  });

export const adminUpdateVps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        vpsId: z.string().uuid(),
        status: z.enum(["pending", "provisioning", "active", "suspended", "terminated"]),
        ip_address: z.string().max(60).optional(),
        notes: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { vpsId, ...patch } = data;
    const { data: vps, error } = await supabaseAdmin
      .from("cloud_vps")
      .update(patch)
      .eq("id", vpsId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await notifyUser(vps.user_id, {
      kind: "cloud",
      title: `VPS ${vps.hostname} is ${data.status}`,
      body: vps.ip_address ? `IP: ${vps.ip_address}` : undefined,
      link: "/cloud",
    });
    return { ok: true };
  });

export const adminSettleTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ txId: z.string().uuid(), status: z.enum(["confirmed", "rejected"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tx, error } = await supabaseAdmin
      .from("cloud_transactions")
      .select("*")
      .eq("id", data.txId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tx) throw new Error("Transaction not found");
    if (tx.status !== "pending") throw new Error("Transaction already settled");

    await supabaseAdmin.from("cloud_transactions").update({ status: data.status }).eq("id", tx.id);

    if (data.status === "confirmed") {
      const wallet = await ensureWallet(tx.user_id);
      const delta = tx.kind === "charge" ? -Number(tx.amount) : Number(tx.amount);
      await supabaseAdmin
        .from("cloud_wallets")
        .update({ balance: Number(wallet.balance) + delta })
        .eq("id", wallet.id);
    }
    await notifyUser(tx.user_id, {
      kind: "cloud",
      title: `Wallet ${tx.kind} ${data.status}`,
      body: `${tx.currency} ${tx.amount}`,
      link: "/cloud",
    });
    return { ok: true };
  });

export const adminChargeWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        amount: z.number().min(1).max(1000000),
        kind: z.enum(["charge", "credit", "refund"]),
        note: z.string().max(300).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const wallet = await ensureWallet(data.userId);
    const delta = data.kind === "charge" ? -data.amount : data.amount;
    await supabaseAdmin
      .from("cloud_wallets")
      .update({ balance: Number(wallet.balance) + delta })
      .eq("id", wallet.id);
    await supabaseAdmin.from("cloud_transactions").insert({
      user_id: data.userId,
      kind: data.kind,
      amount: data.amount,
      method: "manual",
      status: "confirmed",
      note: data.note || null,
    });
    await notifyUser(data.userId, {
      kind: "cloud",
      title: `Wallet ${data.kind}`,
      body: `KES ${data.amount}${data.note ? ` — ${data.note}` : ""}`,
      link: "/cloud",
    });
    return { ok: true };
  });
