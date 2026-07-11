import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* -------------------- Helpers -------------------- */

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

function randomToken(len = 40) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function notifyAdmins(
  ctx: { supabase: any },
  payload: { kind: string; title: string; body?: string; link?: string },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: admins } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "administrator");
  if (!admins?.length) return;
  const rows = admins.map((a: any) => ({
    user_id: a.user_id,
    kind: payload.kind,
    title: payload.title,
    body: payload.body ?? null,
    link: payload.link ?? null,
  }));
  await supabaseAdmin.from("notifications").insert(rows);
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

/* -------------------- Website / service requests -------------------- */

const RequestSchema = z.object({
  service_kind: z.enum(["web", "ui_ux", "software", "hosting_api", "campus"]),
  website_type: z.string().max(80).optional().nullable(),
  booking_type: z.string().max(80).optional().nullable(),
  details: z.record(z.string(), z.any()).default({}),
  features: z.array(z.string().max(120)).default([]),
  contact_email: z.string().email().max(200).optional().nullable(),
  contact_phone: z.string().max(60).optional().nullable(),
});

export const submitWebsiteRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RequestSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("website_requests")
      .insert({
        user_id: context.userId,
        service_kind: data.service_kind,
        website_type: data.website_type ?? null,
        booking_type: data.booking_type ?? null,
        details: data.details,
        features: data.features,
        contact_email: data.contact_email ?? null,
        contact_phone: data.contact_phone ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await notifyAdmins(context, {
      kind: "request.new",
      title: "New client request",
      body: `${data.service_kind.replace("_", " ")}${data.website_type ? " — " + data.website_type : ""}`,
      link: `/admin/requests-website`,
    });
    return row;
  });

export const listMyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("website_requests")
      .select("id,service_kind,website_type,booking_type,status,estimated_price,currency,quoted_at,created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("website_requests")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const listAllRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("website_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const userIds = [...new Set((rows ?? []).map((r: any) => r.user_id))];
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id,email,username,full_name").in("id", userIds)
      : { data: [] as any[] };
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return (rows ?? []).map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

const QuoteSchema = z.object({
  id: z.string().uuid(),
  estimated_price: z.number().nonnegative().max(100000000),
  estimated_days: z.number().int().min(1).max(3650),
  deposit_percent: z.number().int().min(0).max(100),
  currency: z.string().max(8).default("KES"),
  admin_notes: z.string().max(4000).optional().nullable(),
});

export const sendQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => QuoteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = randomToken(48);
    const { data: row, error } = await supabaseAdmin
      .from("website_requests")
      .update({
        status: "quoted",
        estimated_price: data.estimated_price,
        estimated_days: data.estimated_days,
        deposit_percent: data.deposit_percent,
        currency: data.currency,
        admin_notes: data.admin_notes ?? null,
        quote_token: token,
        quoted_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await notifyUser(row.user_id, {
      kind: "quote.sent",
      title: "You have a new quote",
      body: `${data.currency} ${data.estimated_price.toLocaleString()} · ${data.estimated_days} days`,
      link: `/pay/${token}`,
    });
    return { ok: true, token };
  });

const StatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "info_requested", "in_progress", "completed"]),
  admin_notes: z.string().max(4000).optional().nullable(),
});

export const updateRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { status: string; admin_notes?: string | null } = { status: data.status };
    if (data.admin_notes !== undefined) patch.admin_notes = data.admin_notes;
    const { data: row, error } = await supabaseAdmin
      .from("website_requests")
      .update(patch)
      .eq("id", data.id)
      .select("user_id, service_kind")
      .single();
    if (error) throw new Error(error.message);
    await notifyUser(row.user_id, {
      kind: "request.status",
      title: `Your request was ${data.status.replace("_", " ")}`,
      body: data.admin_notes ?? undefined,
      link: `/account/requests/${data.id}`,
    });
    return { ok: true };
  });

/* -------------------- Public quote fetch (no auth) -------------------- */

export const getQuoteByToken = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("website_requests")
      .select("id,service_kind,website_type,booking_type,details,features,estimated_price,currency,estimated_days,deposit_percent,status,admin_notes,quoted_at,user_id")
      .eq("quote_token", data.token)
      .maybeSingle();
    if (!row) return null;
    const { data: pay } = await supabaseAdmin
      .from("payments")
      .select("id,amount,currency,status,method,created_at,confirmed_at")
      .eq("request_id", row.id)
      .order("created_at", { ascending: false });
    return { ...row, payments: pay ?? [] };
  });

/* -------------------- Payments -------------------- */

const PaymentSchema = z.object({
  token: z.string().min(10).max(80),
  method: z.enum(["mpesa", "bank", "manual", "card"]),
  reference: z.string().max(160).optional().nullable(),
  amount: z.number().positive().max(100000000),
});

export const submitPaymentByToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PaymentSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req } = await supabaseAdmin
      .from("website_requests")
      .select("id,user_id,currency")
      .eq("quote_token", data.token)
      .maybeSingle();
    if (!req) throw new Error("Invalid quote link");
    if (req.user_id !== context.userId) throw new Error("This quote belongs to another user");
    const { error } = await supabaseAdmin.from("payments").insert({
      request_id: req.id,
      user_id: req.user_id,
      amount: data.amount,
      currency: req.currency ?? "KES",
      method: data.method,
      reference: data.reference ?? null,
      status: "pending_confirmation",
    });
    if (error) throw new Error(error.message);
    await notifyAdmins(context, {
      kind: "payment.new",
      title: "Payment submitted",
      body: `${req.currency} ${data.amount.toLocaleString()} · ${data.method}`,
      link: `/admin/requests-website`,
    });
    return { ok: true };
  });

export const confirmPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pay, error } = await supabaseAdmin
      .from("payments")
      .update({
        status: "confirmed",
        marked_paid_by: context.userId,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("user_id,request_id,amount,currency")
      .single();
    if (error) throw new Error(error.message);
    await notifyUser(pay.user_id, {
      kind: "payment.confirmed",
      title: "Payment confirmed",
      body: `${pay.currency} ${Number(pay.amount).toLocaleString()} received. Thank you!`,
      link: `/account/requests/${pay.request_id}`,
    });
    return { ok: true };
  });

/* -------------------- Notifications -------------------- */

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const markAllRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { ok: true };
  });

/* -------------------- Live support chat -------------------- */

export const getOrCreateMyThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing } = await context.supabase
      .from("support_threads")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) return existing;
    const { data: row, error } = await context.supabase
      .from("support_threads")
      .insert({ user_id: context.userId, subject: "General" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("support_messages")
      .select("*")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const SendMsgSchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendMsgSchema.parse(d))
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: thread } = await supabaseAdmin
      .from("support_threads")
      .select("id,user_id")
      .eq("id", data.threadId)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found");
    if (!admin && thread.user_id !== context.userId) throw new Error("Forbidden");

    const { error } = await supabaseAdmin.from("support_messages").insert({
      thread_id: data.threadId,
      sender_id: context.userId,
      sender_role: admin ? "admin" : "user",
      body: data.body,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("support_threads")
      .update({
        last_message_at: new Date().toISOString(),
        unread_user: admin ? 1 : 0,
        unread_admin: admin ? 0 : 1,
      })
      .eq("id", data.threadId);

    if (admin) {
      await notifyUser(thread.user_id, {
        kind: "support.reply",
        title: "New message from support",
        body: data.body.slice(0, 140),
        link: "/support",
      });
    } else {
      await notifyAdmins(context, {
        kind: "support.new",
        title: "New support message",
        body: data.body.slice(0, 140),
        link: "/admin/support",
      });
    }
    return { ok: true };
  });

export const listAllThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("support_threads")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(200);
    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id))];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id,email,username,full_name").in("id", ids)
      : { data: [] as any[] };
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return (rows ?? []).map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("support_threads")
      .update(admin ? { unread_admin: 0 } : { unread_user: 0 })
      .eq("id", data.threadId);
    return { ok: true };
  });
