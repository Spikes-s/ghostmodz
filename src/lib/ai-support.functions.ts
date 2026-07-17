import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

async function isAdmin(ctx: { supabase: any; userId: string }): Promise<boolean> {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "administrator")
    .maybeSingle();
  return !!data;
}

export const getAiSupportSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_support_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });


const SettingsSchema = z.object({
  ai_globally_enabled: z.boolean(),
  welcome_message: z.string().max(1000),
  business_description: z.string().max(4000),
  business_hours: z.string().max(400),
  contact_details: z.string().max(1000),
  faqs: z.array(z.object({ q: z.string().max(400), a: z.string().max(2000) })).max(50),
  response_style: z.string().max(400),
  max_response_length: z.number().int().min(50).max(2000),
  supported_languages: z.array(z.string().max(40)).max(30),
  escalation_rules: z.string().max(2000),
});

export const updateAiSupportSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("ai_support_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin
        .from("ai_support_settings")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("ai_support_settings").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setThreadAiEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ threadId: z.string().uuid(), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("support_threads")
      .update({
        ai_enabled: data.enabled,
        admin_active: !data.enabled,
        mode: data.enabled ? "ai" : "admin",
      })
      .eq("id", data.threadId);
    return { ok: true };
  });

export const generateAiReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: thread } = await supabaseAdmin
      .from("support_threads")
      .select("*")
      .eq("id", data.threadId)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found");
    if (thread.user_id !== context.userId) throw new Error("Forbidden");
    if (!thread.ai_enabled || thread.admin_active) {
      return { ok: false, reason: "ai_disabled" };
    }

    const { data: settings } = await supabaseAdmin
      .from("ai_support_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (!settings || !settings.ai_globally_enabled) {
      return { ok: false, reason: "globally_disabled" };
    }

    const { data: history } = await supabaseAdmin
      .from("support_messages")
      .select("sender_role, body, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(30);

    const faqBlock = (settings.faqs as Array<{ q: string; a: string }>)
      .map((f) => `Q: ${f.q}\nA: ${f.a}`)
      .join("\n\n") || "(none configured)";

    const system = `You are the Ghost Mods Tech AI customer support assistant.

BUSINESS INFO
${settings.business_description}

BUSINESS HOURS
${settings.business_hours}

CONTACT
${settings.contact_details || "(not configured)"}

FAQs
${faqBlock}

STYLE
${settings.response_style}. Keep replies under ~${settings.max_response_length} characters unless the user asks for detail. Do not repeat greetings. Vary phrasing.

LANGUAGES
Detect the visitor's language and respond in it if it is one of: ${settings.supported_languages.join(", ")}. Otherwise, respond politely in English and note the limitation.

ESCALATION
${settings.escalation_rules}

RULES
- Never invent company-specific information that is not in the BUSINESS INFO, CONTACT, or FAQs above. If you don't know, say so honestly and offer to connect a human administrator.
- Ask a short clarifying question when the request is ambiguous.
- Answer questions about services, pricing process, website requests, courses, Build Mode, company info, contact info, office hours, and FAQs.
- Never claim to be human. You may identify as "Ghost Mods AI Assistant".`;

    const messages = (history ?? []).map((m: any) => ({
      role: m.sender_role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.body,
    }));

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    let replyText = "";
    let language: string | null = null;
    try {
      const { text } = await generateText({
        model: gateway("google/gemini-3.5-flash"),
        system,
        messages,
      });
      replyText = text.trim();

      // Best-effort language detection
      const { text: lang } = await generateText({
        model: gateway("google/gemini-3.1-flash-lite"),
        system:
          "Reply with ONLY the English name of the language of the following text (e.g. 'English', 'Swahili', 'French'). No punctuation.",
        messages: [
          {
            role: "user",
            content: messages[messages.length - 1]?.content?.slice(0, 500) ?? "",
          },
        ],
      });
      language = lang.trim().split(/\s+/)[0] || null;
    } catch (e: any) {
      throw new Error(e?.message || "AI generation failed");
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("support_messages")
      .insert({
        thread_id: data.threadId,
        sender_id: thread.user_id, // schema requires an auth user id; attribute to the thread owner
        sender_role: "ai",
        body: replyText,
        language,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("support_threads")
      .update({
        last_message_at: new Date().toISOString(),
        language,
        unread_admin: 0,
      })
      .eq("id", data.threadId);

    return { ok: true, message: inserted };
  });
