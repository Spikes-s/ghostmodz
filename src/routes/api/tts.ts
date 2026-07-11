import { createFileRoute } from "@tanstack/react-router";
import { requireApiUser } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireApiUser(request);
        if (!auth.ok) return auth.response;

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { text } = (await request.json()) as { text?: string };
        if (!text || text.trim().length === 0) {
          return new Response("Text required", { status: 400 });
        }

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text.slice(0, 4000),
            voice: "alloy",
          }),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          return new Response(t || "TTS failed", { status: res.status });
        }
        return new Response(res.body, {
          headers: { "Content-Type": res.headers.get("content-type") || "audio/mpeg" },
        });
      },
    },
  },
});
