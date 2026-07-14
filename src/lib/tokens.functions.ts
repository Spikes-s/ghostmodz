import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PRIMARY_ADMIN_EMAIL = "spikesprimo6625@gmail.com";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "administrator")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: administrator role required");
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function generateToken(len = 20): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "GMT#";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

/* -------------------- BUILD MODE ACCESS -------------------- */

export const isPrimaryAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as any)?.email?.toLowerCase?.();
    return { primary: email === PRIMARY_ADMIN_EMAIL };
  });

export const redeemAccessToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ token: z.string().min(4).max(128) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const { data: row, error } = await admin
      .from("access_tokens")
      .select("*")
      .eq("token", data.token.trim())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Invalid token.");
    if (row.revoked) throw new Error("This token has been revoked.");
    if (row.consumed_at) throw new Error("This token was already used.");
    if (row.expires_at && new Date(row.expires_at) < new Date())
      throw new Error("This token has expired.");

    const { error: upErr } = await admin
      .from("access_tokens")
      .update({ consumed_at: new Date().toISOString(), consumed_by: context.userId })
      .eq("id", row.id)
      .is("consumed_at", null);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

/* -------------------- ADMIN: TOKENS -------------------- */

export const listAccessTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { data, error } = await admin
      .from("access_tokens")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createAccessToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        custom: z.string().optional(),
        label: z.string().optional(),
        expiresAt: z.string().nullable().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const token = data.custom?.trim() || generateToken();
    const { data: row, error } = await admin
      .from("access_tokens")
      .insert({
        token,
        label: data.label ?? null,
        expires_at: data.expiresAt || null,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const revokeAccessToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { error } = await admin
      .from("access_tokens")
      .update({ revoked: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAccessToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { error } = await admin.from("access_tokens").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- TOKEN REQUESTS -------------------- */

export const requestAccessToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ reason: z.string().max(500).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("token_requests")
      .select("id")
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) throw new Error("You already have a pending request.");
    const { error } = await context.supabase
      .from("token_requests")
      .insert({ user_id: context.userId, reason: data.reason ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("token_requests")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listTokenRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { data, error } = await admin
      .from("token_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = [...new Set((data ?? []).map((r) => r.user_id))];
    const { data: profiles } = ids.length
      ? await admin.from("profiles").select("id,email,username").in("id", ids)
      : { data: [] as any[] };
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return (data ?? []).map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

export const approveTokenRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const token = generateToken();
    const { data: t, error: tErr } = await admin
      .from("access_tokens")
      .insert({ token, label: "request approval", created_by: context.userId })
      .select("id,token")
      .single();
    if (tErr) throw new Error(tErr.message);
    const { error } = await admin
      .from("token_requests")
      .update({
        status: "approved",
        issued_token_id: t.id,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { token: t.token };
  });

export const denyTokenRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { error } = await admin
      .from("token_requests")
      .update({
        status: "denied",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- SITE SETTINGS -------------------- */

const SettingsSchema = z.object({
  site_name: z.string().min(1).max(120).optional(),
  logo_url: z.string().max(500).nullable().optional(),
  favicon_url: z.string().max(500).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  contact_email: z.string().max(200).nullable().optional(),
  contact_phone: z.string().max(80).nullable().optional(),
  socials: z.record(z.string(), z.string()).optional(),
  footer_text: z.string().max(1000).nullable().optional(),
  homepage_banner: z.string().max(500).nullable().optional(),
  seo_title: z.string().max(200).nullable().optional(),
  seo_description: z.string().max(400).nullable().optional(),
  maintenance_mode: z.boolean().optional(),
  theme: z.record(z.string(), z.any()).optional(),
  whatsapp_bot_url: z.string().max(500).nullable().optional(),
  cloud_solutions_url: z.string().max(500).nullable().optional(),
  hero_title: z.string().max(200).nullable().optional(),
  hero_subtitle: z.string().max(500).nullable().optional(),
});

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await getAdmin();
  const { data } = await admin.from("site_settings").select("*").eq("id", 1).maybeSingle();
  return data;
});

export const updateSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { error } = await admin.from("site_settings").update(data).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- SERVICES CMS -------------------- */

const FeatureSchema = z.object({
  title: z.string().max(120),
  description: z.string().max(600).optional().default(""),
  icon: z.string().max(80).optional().nullable(),
});
const PricingSchema = z.object({
  name: z.string().max(80),
  price: z.string().max(80),
  period: z.string().max(40).optional().default(""),
  highlight: z.boolean().optional().default(false),
  features: z.array(z.string().max(200)).default([]),
  cta_label: z.string().max(80).optional().default("Get started"),
  cta_url: z.string().max(500).optional().default(""),
});
const FaqSchema = z.object({
  q: z.string().max(300),
  a: z.string().max(2000),
});

const ServiceSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/, "lowercase, digits, hyphens"),
  title: z.string().min(1).max(200),
  tagline: z.string().max(300).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  body_md: z.string().max(20000).nullable().optional(),
  icon: z.string().max(80).nullable().optional(),
  image_url: z.string().max(500).nullable().optional(),
  hero_image_url: z.string().max(500).nullable().optional(),
  link_type: z.enum(["internal", "external"]),
  link_url: z.string().max(500).nullable().optional(),
  sort_order: z.number().int().optional(),
  published: z.boolean().optional(),
  features: z.array(FeatureSchema).optional().default([]),
  pricing: z.array(PricingSchema).optional().default([]),
  faqs: z.array(FaqSchema).optional().default([]),
});

export const listServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { data } = await admin
      .from("services")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    return data ?? [];
  });

export const listPublishedServices = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await getAdmin();
  const { data } = await admin
    .from("services")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
});

export const getServiceBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { data: row } = await admin
      .from("services")
      .select("*")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    return row;
  });

export const upsertService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ServiceSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    if (data.id) {
      const { error } = await admin.from("services").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("services").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { error } = await admin.from("services").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

