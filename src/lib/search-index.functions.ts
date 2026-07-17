import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SearchHit = {
  id: string;
  type: "conversation" | "project" | "api_project" | "website_request" | "notification";
  title: string;
  subtitle?: string;
  href: string;
  updatedAt?: string;
};

const inputSchema = z.object({ q: z.string().max(200).optional().default("") });

export const searchAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ context, data }): Promise<SearchHit[]> => {
    const q = data.q.trim();
    const like = q ? `%${q.replace(/[%_]/g, "")}%` : null;
    const sb = context.supabase;

    const results: SearchHit[] = [];

    const convQ = sb
      .from("conversations")
      .select("id, title, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(6);
    const projQ = sb
      .from("projects")
      .select("id, name, description, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(6);
    const apiQ = sb
      .from("api_projects")
      .select("id, name, api_type, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(6);
    const reqQ = sb
      .from("website_requests")
      .select("id, service_kind, website_type, status, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(6);
    const notifQ = sb
      .from("notifications")
      .select("id, title, body, link, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(6);

    const [conv, proj, api, req, notif] = await Promise.all([
      like ? convQ.ilike("title", like) : convQ,
      like ? projQ.or(`name.ilike.${like},description.ilike.${like}`) : projQ,
      like ? apiQ.ilike("name", like) : apiQ,
      like ? reqQ.ilike("project_name", like) : reqQ,
      like ? notifQ.or(`title.ilike.${like},body.ilike.${like}`) : notifQ,
    ]);

    for (const c of conv.data ?? [])
      results.push({
        id: c.id,
        type: "conversation",
        title: c.title || "Untitled chat",
        subtitle: "Spikes conversation",
        href: `/spikes/${c.id}`,
        updatedAt: c.updated_at as string,
      });
    for (const p of proj.data ?? [])
      results.push({
        id: p.id,
        type: "project",
        title: p.name,
        subtitle: (p.description as string) || "Build project",
        href: `/build/${p.id}`,
        updatedAt: p.updated_at as string,
      });
    for (const a of api.data ?? [])
      results.push({
        id: a.id,
        type: "api_project",
        title: a.name,
        subtitle: `API · ${a.api_type ?? "rest"}`,
        href: `/services/api-dev/${a.id}`,
        updatedAt: a.updated_at as string,
      });
    for (const r of req.data ?? [])
      results.push({
        id: r.id,
        type: "website_request",
        title: r.website_type || r.service_kind || "Website request",
        subtitle: `Request · ${r.status ?? "pending"}`,
        href: `/account/requests/${r.id}`,
        updatedAt: r.updated_at as string,
      });
    for (const n of notif.data ?? [])
      results.push({
        id: n.id,
        type: "notification",
        title: n.title,
        subtitle: (n.body as string) || "Notification",
        href: (n.link as string) || "/support",
        updatedAt: n.created_at as string,
      });

    return results;
  });

export const getContinueWorking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [proj, api, conv, req] = await Promise.all([
      sb.from("projects").select("id, name, description, updated_at").eq("user_id", context.userId).order("updated_at", { ascending: false }).limit(5),
      sb.from("api_projects").select("id, name, api_type, updated_at").eq("user_id", context.userId).order("updated_at", { ascending: false }).limit(5),
      sb.from("conversations").select("id, title, updated_at").eq("user_id", context.userId).order("updated_at", { ascending: false }).limit(5),
      sb.from("website_requests").select("id, service_kind, website_type, status, updated_at").eq("user_id", context.userId).order("updated_at", { ascending: false }).limit(5),
    ]);

    type Item = { id: string; kind: string; title: string; subtitle: string; href: string; updatedAt: string };
    const items: Item[] = [];
    for (const p of proj.data ?? []) items.push({ id: p.id, kind: "Build", title: p.name, subtitle: (p.description as string) || "Build project", href: `/build/${p.id}`, updatedAt: p.updated_at as string });
    for (const a of api.data ?? []) items.push({ id: a.id, kind: "API", title: a.name, subtitle: `API project · ${a.api_type ?? "rest"}`, href: `/services/api-dev/${a.id}`, updatedAt: a.updated_at as string });
    for (const c of conv.data ?? []) items.push({ id: c.id, kind: "Chat", title: c.title || "Untitled chat", subtitle: "Spikes conversation", href: `/spikes/${c.id}`, updatedAt: c.updated_at as string });
    for (const r of req.data ?? []) items.push({ id: r.id, kind: "Request", title: r.website_type || r.service_kind || "Website request", subtitle: `Status · ${r.status ?? "pending"}`, href: `/account/requests/${r.id}`, updatedAt: r.updated_at as string });

    items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return { latest: items[0] ?? null, recent: items.slice(0, 6) };
  });
