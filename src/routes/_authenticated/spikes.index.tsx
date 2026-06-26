import { createFileRoute, redirect } from "@tanstack/react-router";
import { createConversation, listConversations } from "@/lib/spikes.functions";

export const Route = createFileRoute("/_authenticated/spikes/")({
  loader: async () => {
    const list = await listConversations();
    if (list.length > 0) {
      throw redirect({ to: "/spikes/$conversationId", params: { conversationId: list[0].id } });
    }
    const created = await createConversation({ data: { title: "New Chat", mode: "talk" } });
    throw redirect({ to: "/spikes/$conversationId", params: { conversationId: created.id } });
  },
  component: () => null,
});
