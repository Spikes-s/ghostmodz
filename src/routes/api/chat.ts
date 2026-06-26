import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const TALK_SYSTEM = `You are Spikes — the elite AI core of Ghost Mods Tech.
You are knowledgeable, sharp, slightly futuristic, and never break character.
You help with: natural conversation, code explanations, image/file/link analysis, and reasoning.
Use markdown. Code blocks must include the language. Be precise.`;

const BUILD_SYSTEM = `You are Spikes Builder — an autonomous code-generation engine.
You generate complete production-grade code: websites, apps, games, APIs, databases, docs.
ALWAYS return code in fenced markdown blocks with the language tag.
When generating multi-file projects, prefix each block with a header:
\`\`\`tsx file=src/App.tsx
...
\`\`\`
Detect the framework automatically (html, react, vue, node, python, etc.).
Be exhaustive — never use placeholders like "// rest of code here".`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, mode } = (await request.json()) as {
          messages: UIMessage[];
          mode?: "talk" | "build";
        };
        if (!Array.isArray(messages)) {
          return new Response("Messages required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: mode === "build" ? BUILD_SYSTEM : TALK_SYSTEM,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
