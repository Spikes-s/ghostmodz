import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type EngineReply<T> = { ok: true; data: T } | { ok: false; status: number; message: string };
export type SpikesEngineCommand = {
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  readiness: "ready" | "missing_configuration";
  missingConfiguration: string[];
};
export type SpikesEngineActivity = {
  at: string;
  command: string;
  result: "success" | "failed";
  chatType: "group" | "direct";
};

async function assertBotAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "administrator")
    .maybeSingle();
  if (error || !data) throw new Error("Administrator access is required.");
}

function engineConfig() {
  const rawUrl = process.env["SPIKES_ENGINE_URL"]?.trim();
  const token = process.env["SPIKES_ENGINE_TOKEN"];
  if (!rawUrl || !token) return null;
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("The Spikes service address must use HTTPS.");
  }
  return { url: url.toString().replace(/\/$/, ""), token };
}

async function engineRequest<T>(path: string, method = "GET", body?: unknown): Promise<EngineReply<T>> {
  const config = engineConfig();
  if (!config) return { ok: false, status: 0, message: "Spikes service is not configured yet." };
  try {
    const response = await fetch(`${config.url}${path}`, {
      method,
      redirect: "manual",
      headers: { Authorization: `Bearer ${config.token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(8000),
    });
    const payload = (await response.json().catch(() => null)) as T | null;
    if (!response.ok || payload === null) {
      return { ok: false, status: response.status, message: response.status >= 500 ? "Spikes service returned an error." : "Spikes service rejected the request." };
    }
    return { ok: true, data: payload };
  } catch {
    return { ok: false, status: 0, message: "Spikes service cannot be reached. Confirm its hosting is running." };
  }
}

export const getSpikesEngineStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBotAdmin(context);
    const configured = Boolean(process.env["SPIKES_ENGINE_URL"] && process.env["SPIKES_ENGINE_TOKEN"]);
    if (!configured) return { configured: false, state: "not_configured", message: "Deploy the Spikes service and configure its address and shared access token." };
    const result = await engineRequest<Record<string, unknown>>("/api/status");
    return result.ok ? { configured: true, ...result.data } : { configured: true, state: "unreachable", message: result.message };
  });

export const getSpikesEngineCommands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBotAdmin(context);
    const result = await engineRequest<{ commands: SpikesEngineCommand[] }>("/api/commands");
    if (!result.ok) throw new Error(result.message);
    return result.data.commands;
  });

export const getSpikesEngineActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBotAdmin(context);
    const result = await engineRequest<{ activity: SpikesEngineActivity[] }>("/api/activity");
    if (!result.ok) throw new Error(result.message);
    return result.data.activity;
  });

export const pairSpikesWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ phoneNumber: z.string().regex(/^\+?[1-9]\d{6,14}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertBotAdmin(context);
    const phoneNumber = data.phoneNumber.replace(/\D/g, "");
    const result = await engineRequest<{ code: string; expiresAt: string }>("/api/pair", "POST", { phoneNumber });
    if (!result.ok) throw new Error(result.message);
    return result.data;
  });

export const reconnectSpikesEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBotAdmin(context);
    const result = await engineRequest<{ state: string }>("/api/reconnect", "POST", {});
    if (!result.ok) throw new Error(result.message);
    return result.data;
  });

export const disconnectSpikesEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBotAdmin(context);
    const result = await engineRequest<{ state: string }>("/api/disconnect", "POST", {});
    if (!result.ok) throw new Error(result.message);
    return result.data;
  });

export const setSpikesCommandState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ name: z.string().regex(/^[a-z0-9]+$/), enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertBotAdmin(context);
    const result = await engineRequest<{ name: string; enabled: boolean }>(`/api/commands/${data.name}`, "POST", { enabled: data.enabled });
    if (!result.ok) throw new Error(result.message);
    return result.data;
  });