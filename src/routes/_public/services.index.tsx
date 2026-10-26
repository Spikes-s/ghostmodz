import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { listPublishedServices } from "@/lib/tokens.functions";

export const Route = createFileRoute("/_public/services/")({
  head: () => ({
    meta: [
      { title: "Services — Ghost Mods Tech" },
      {
        name: "description",
        content:
          "Full-stack engineering, bots, AI automation, ethical-hacking training, cloud and more from Ghost Mods Tech. Open any service for features, pricing and FAQs.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Services — Ghost Mods Tech" },
      { property: "og:description", content: "Explore each Ghost Mods Tech service in detail — features, pricing, FAQs." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Services — Ghost Mods Tech" },
      { name: "twitter:description", content: "Explore each Ghost Mods Tech service in detail." },
    ],
  }),
  component: ServicesIndex,
});

function ServicesIndex() {
  const listFn = useServerFn(listPublishedServices);
  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services", "public"],
    queryFn: () => listFn(),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
      <div className="text-center mb-12">
        <p className="text-xs font-mono tracking-[0.3em] text-primary mb-3">// SERVICES</p>
        <h1 className="text-4xl md:text-6xl font-bold mb-4">
          Everything we <span className="neon-text">engineer</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Explore each service in detail — features, pricing, and answers to common questions.
        </p>
      </div>

      {isLoading ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : services.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center max-w-lg mx-auto">
          <Wrench className="h-8 w-8 text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">No services published yet. Check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s: any, i: number) => (
            <Link
              key={s.id}
              to="/services/$slug"
              params={{ slug: s.slug }}
              className="group glass-card rounded-xl p-6 hover-glow animate-fade-up block"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="grid h-12 w-12 place-items-center rounded-lg glass neon-border mb-5 transition-transform group-hover:scale-110">
                <span className="text-2xl">{s.icon || "🛠️"}</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
              {s.tagline && (
                <p className="text-xs text-primary/80 mb-2 font-mono">{s.tagline}</p>
              )}
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed line-clamp-3">
                {s.description}
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                Learn more →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
