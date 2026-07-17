import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function isAdmin(ctx: { supabase: any; userId: string }): Promise<boolean> {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "administrator")
    .maybeSingle();
  return !!data;
}

const ProjectCreate = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(4000).default(""),
  api_type: z.enum(["REST", "GraphQL", "Webhook", "Auth", "Payment", "FileUpload", "Custom"]),
  base_url: z.string().max(500).default(""),
  version: z.string().max(30).default("v1"),
  auth_type: z.enum(["none", "api_key", "jwt", "oauth2", "bearer"]).default("none"),
});

export const createApiProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProjectCreate.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("api_projects")
      .insert({ ...data, user_id: context.userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateApiProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: ProjectCreate.partial().extend({
          status: z.enum(["draft", "ready", "submitted"]).optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("api_projects")
      .update(data.patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteApiProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("api_projects")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyApiProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("api_projects")
      .select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getApiProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = admin ? supabaseAdmin : context.supabase;
    const { data: project } = await client
      .from("api_projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!project) return null;
    if (!admin && project.user_id !== context.userId) throw new Error("Forbidden");
    const [{ data: endpoints }, { data: envs }] = await Promise.all([
      client.from("api_endpoints").select("*").eq("project_id", data.id).order("created_at"),
      admin || project.user_id === context.userId
        ? context.supabase.from("api_env_vars").select("*").eq("project_id", data.id)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    return { ...project, endpoints: endpoints ?? [], env_vars: envs ?? [] };
  });

/* Endpoints */
const EndpointSchema = z.object({
  project_id: z.string().uuid(),
  route: z.string().min(1).max(400),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  description: z.string().max(2000).default(""),
  parameters: z.array(z.any()).default([]),
  headers: z.array(z.any()).default([]),
  request_body: z.record(z.string(), z.any()).default({}),
  response_body: z.record(z.string(), z.any()).default({}),
  validation: z.record(z.string(), z.any()).default({}),
});

export const upsertEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), data: EndpointSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("api_endpoints")
        .update(data.data)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("api_endpoints")
      .insert(data.data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("api_endpoints").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* Env vars */
export const upsertEnvVar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        project_id: z.string().uuid(),
        key: z.string().min(1).max(200),
        value: z.string().max(4000).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    if (id) {
      const { error } = await context.supabase.from("api_env_vars").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase.from("api_env_vars").insert(rest);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEnvVar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("api_env_vars").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* Test an endpoint from the server */
export const testEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        endpointId: z.string().uuid(),
        overrideBaseUrl: z.string().max(500).optional(),
        overrideBody: z.string().max(20000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("api_projects")
      .select("id,user_id,base_url,auth_type")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project || project.user_id !== context.userId) throw new Error("Forbidden");
    const { data: endpoint } = await context.supabase
      .from("api_endpoints")
      .select("*")
      .eq("id", data.endpointId)
      .maybeSingle();
    if (!endpoint) throw new Error("Endpoint not found");

    const base = (data.overrideBaseUrl || project.base_url || "").replace(/\/$/, "");
    const url = `${base}${endpoint.route.startsWith("/") ? "" : "/"}${endpoint.route}`;

    // SSRF protection: only allow http(s) to public hosts.
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Invalid URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http and https URLs are allowed");
    }
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const blockedHostnames = new Set([
      "localhost",
      "ip6-localhost",
      "ip6-loopback",
      "metadata.google.internal",
      "metadata.goog",
    ]);
    if (blockedHostnames.has(host) || host.endsWith(".localhost") || host.endsWith(".internal")) {
      throw new Error("Target host is not allowed");
    }
    const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
    if (isIpv4) {
      const parts = host.split(".").map((n) => parseInt(n, 10));
      if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
        throw new Error("Invalid IP address");
      }
      const [a, b] = parts;
      const isPrivate =
        a === 10 ||
        a === 127 ||
        a === 0 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) ||
        a >= 224; // multicast + reserved
      if (isPrivate) throw new Error("Private/loopback IPs are not allowed");
    }
    if (host.includes(":")) {
      // IPv6 — block loopback, link-local, unique-local, and unspecified.
      const h = host;
      if (
        h === "::" ||
        h === "::1" ||
        h.startsWith("fe80:") ||
        h.startsWith("fc") ||
        h.startsWith("fd") ||
        h.startsWith("::ffff:")
      ) {
        throw new Error("Private/loopback IPv6 addresses are not allowed");
      }
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    for (const h of (endpoint.headers as Array<{ key: string; value: string }>) ?? []) {
      if (h?.key) headers[h.key] = h.value ?? "";
    }


    const started = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const body =
        endpoint.method === "GET" || endpoint.method === "DELETE"
          ? undefined
          : data.overrideBody ?? JSON.stringify(endpoint.request_body ?? {});
      const res = await fetch(url, {
        method: endpoint.method,
        headers,
        body,
        signal: controller.signal,
      });
      const text = await res.text();
      const bodyOut = text.slice(0, 20000);
      return {
        ok: true,
        status: res.status,
        statusText: res.statusText,
        ms: Math.round(performance.now() - started),
        body: bodyOut,
      };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Request failed", ms: Math.round(performance.now() - started) };
    } finally {
      clearTimeout(timeout);
    }
  });

/* Generate docs */
export const generateApiDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("api_projects")
      .select("*")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Not found");
    const { data: endpoints } = await context.supabase
      .from("api_endpoints")
      .select("*")
      .eq("project_id", data.projectId)
      .order("created_at");

    const lines: string[] = [
      `# ${project.name}`,
      "",
      project.description || "",
      "",
      `**Type:** ${project.api_type}  `,
      `**Version:** ${project.version}  `,
      `**Base URL:** \`${project.base_url || "(not set)"}\`  `,
      `**Authentication:** ${project.auth_type}`,
      "",
      "## Endpoints",
      "",
    ];
    for (const e of endpoints ?? []) {
      lines.push(`### \`${e.method}\` ${e.route}`);
      if (e.description) lines.push("", e.description);
      lines.push("", "**Headers**", "```json", JSON.stringify(e.headers, null, 2), "```");
      lines.push("**Request Body**", "```json", JSON.stringify(e.request_body, null, 2), "```");
      lines.push("**Response**", "```json", JSON.stringify(e.response_body, null, 2), "```", "");
    }
    return { markdown: lines.join("\n") };
  });

/* Admin */
export const listAllApiProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("api_projects")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id))];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id,email,username,full_name").in("id", ids)
      : { data: [] as any[] };
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return (rows ?? []).map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

export const listProjectComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("api_project_comments")
      .select("*")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: true });
    return rows ?? [];
  });

export const addProjectComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const { error } = await context.supabase.from("api_project_comments").insert({
      project_id: data.projectId,
      author_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
