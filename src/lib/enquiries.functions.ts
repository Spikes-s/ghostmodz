import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* -------------------- PUBLIC ENQUIRIES -------------------- */

export const EnquiryInputSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120),
  email: z.string().trim().email("Enter a valid email").max(200),
  phone: z.string().trim().max(60).optional().default(""),
  serviceSlug: z.string().trim().max(120).optional().default(""),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a bit more (at least 10 characters)")
    .max(2000),
  // Honeypot: real users never fill this; bots do.
  website: z.string().max(200).optional().default(""),
});

export const submitEnquiry = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => EnquiryInputSchema.parse(d))
  .handler(async ({ data }) => {
    if (data.website) throw new Error("Submission blocked.");
    const mod = await import("@/integrations/supabase/client.server");
    const admin = mod.supabaseAdmin as any;
    const { error } = await admin.from("enquiries").insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      service_slug: data.serviceSlug || null,
      message: data.message,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* -------------------- ADMIN: ENQUIRIES -------------------- */

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "administrator")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: administrator role required");
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const listEnquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { data, error } = await admin
      .from("enquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setEnquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "contacted", "closed"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { error } = await admin
      .from("enquiries")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
