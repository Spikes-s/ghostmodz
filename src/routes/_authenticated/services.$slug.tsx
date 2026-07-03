import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ArrowLeft } from "lucide-react";
import { getServiceBySlug } from "@/lib/tokens.functions";
import { Markdown } from "@/components/ghost/Markdown";

export const Route = createFileRoute("/_authenticated/services/$slug")({
  component: ServicePage,
});

function ServicePage() {
  const { slug } = Route.useParams();
  const fetchFn = useServerFn(getServiceBySlug);
  const { data: service, isLoading } = useQuery({
    queryKey: ["service", slug],
    queryFn: () => fetchFn({ data: { slug } }),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-24 text-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!service) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-3xl font-bold neon-text mb-2">Service not found</h1>
        <p className="text-muted-foreground mb-6">
          This service doesn't exist or hasn't been published yet.
        </p>
        <Button asChild variant="outline" className="glass gap-2">
          <Link to="/services"><ArrowLeft className="h-4 w-4" /> All services</Link>
        </Button>
      </div>
    );
  }

  const features: any[] = Array.isArray(service.features) ? service.features : [];
  const pricing: any[] = Array.isArray(service.pricing) ? service.pricing : [];
  const faqs: any[] = Array.isArray(service.faqs) ? service.faqs : [];

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-16">
          <Link
            to="/services"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-primary mb-6"
          >
            <ArrowLeft className="h-3 w-3" /> ALL SERVICES
          </Link>
          <div className="grid lg:grid-cols-[1fr,auto] gap-8 items-center">
            <div>
              {service.tagline && (
                <p className="text-xs font-mono tracking-[0.3em] text-primary mb-3">
                  // {service.tagline}
                </p>
              )}
              <h1 className="text-4xl md:text-6xl font-bold mb-4">
                <span className="neon-text">{service.title}</span>
              </h1>
              {service.description && (
                <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
                  {service.description}
                </p>
              )}
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="glow-purple gap-2">
                  <Link to="/spikes"><Sparkles className="h-4 w-4" /> Talk to Spikes</Link>
                </Button>
                {pricing[0]?.cta_url && (
                  <Button asChild size="lg" variant="outline" className="glass hover-glow">
                    <a href={pricing[0].cta_url}>{pricing[0].cta_label || "Get started"}</a>
                  </Button>
                )}
              </div>
            </div>
            {service.hero_image_url && (
              <img
                src={service.hero_image_url}
                alt={service.title}
                className="rounded-xl glass-card max-w-sm w-full object-cover"
              />
            )}
          </div>
        </div>
      </section>

      {/* BODY */}
      {service.body_md && (
        <section className="mx-auto max-w-4xl px-6 py-12">
          <div className="glass-card rounded-2xl p-8">
            <Markdown content={service.body_md} />
          </div>
        </section>
      )}

      {/* FEATURES */}
      {features.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="text-center mb-10">
            <p className="text-xs font-mono tracking-[0.3em] text-secondary mb-3">// FEATURES</p>
            <h2 className="text-3xl md:text-4xl font-bold">What's included</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={i}
                className="glass-card rounded-xl p-6 hover-glow animate-fade-up"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg glass neon-border mb-4">
                  <span className="text-xl">{f.icon || "⚡"}</span>
                </div>
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PRICING */}
      {pricing.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="text-center mb-10">
            <p className="text-xs font-mono tracking-[0.3em] text-primary mb-3">// PRICING</p>
            <h2 className="text-3xl md:text-4xl font-bold">
              Choose your <span className="neon-text">tier</span>
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {pricing.map((p, i) => (
              <div
                key={i}
                className={`relative glass-card rounded-xl p-6 flex flex-col ${
                  p.highlight ? "neon-border glow-purple" : ""
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-mono tracking-widest bg-primary text-primary-foreground px-3 py-1 rounded-full">
                    RECOMMENDED
                  </span>
                )}
                <h3 className="text-lg font-semibold mb-1">{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold neon-text">{p.price}</span>
                  {p.period && (
                    <span className="text-xs text-muted-foreground">/{p.period}</span>
                  )}
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {(p.features || []).map((f: string, j: number) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={p.highlight ? "glow-purple" : ""}
                  variant={p.highlight ? "default" : "outline"}
                >
                  <a href={p.cta_url || "#"}>{p.cta_label || "Get started"}</a>
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQs */}
      {faqs.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 py-16">
          <div className="text-center mb-8">
            <p className="text-xs font-mono tracking-[0.3em] text-secondary mb-3">// FAQ</p>
            <h2 className="text-3xl md:text-4xl font-bold">Questions & answers</h2>
          </div>
          <Accordion type="single" collapsible className="glass-card rounded-xl px-6">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="glass-card rounded-2xl p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 cyber-grid opacity-40 pointer-events-none" />
          <h3 className="text-3xl font-bold mb-3 relative">
            Ready to <span className="neon-text">start</span>?
          </h3>
          <p className="text-muted-foreground mb-6 relative">
            Get in touch with Spikes to scope your project.
          </p>
          <Button asChild size="lg" className="glow-purple gap-2 relative">
            <Link to="/spikes"><Sparkles className="h-4 w-4" /> Talk to Spikes</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
