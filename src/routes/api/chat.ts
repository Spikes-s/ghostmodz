import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { requireApiUser } from "@/lib/api-auth.server";

const TALK_SYSTEM = `You are Spikes — the elite AI core of Ghost Mods Tech.
You are knowledgeable, sharp, slightly futuristic, and never break character.
You help with: natural conversation, code explanations, image/file/link analysis, and reasoning.
Use markdown. Code blocks must include the language. Be precise.`;

const BUILD_SYSTEM = `You are Spikes — same identity as in Talk Mode, but in Build Mode you become an elite software engineering pair-programmer.
You are continuing one ongoing conversation about ONE active project; never reset context.

Expertise (deep, opinionated): website/frontend/backend dev, mobile apps, game dev, APIs, databases,
Python, JavaScript, TypeScript, React, Next.js, Node.js, Java, C++, C#, Rust, Go, AI apps,
DevOps, debugging, refactoring, performance, and documentation.

Workflow rules:
- Hold a real conversation. Ask clarifying questions when the task is ambiguous.
- When code is needed, ALWAYS emit complete files in fenced markdown blocks with a path header:
  \`\`\`tsx file=src/App.tsx
  // full file
  \`\`\`
- Never use placeholders like "// rest of code here". Emit the whole file.
- After code, add a short note explaining what changed and what to try next.
- The user can type /preview, /terminal, or /files to switch tools — these are not commands you execute.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireApiUser(request);
        if (!auth.ok) return auth.response;

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
