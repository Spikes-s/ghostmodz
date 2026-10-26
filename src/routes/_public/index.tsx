import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Rocket, Sparkles, Target, Eye, Zap, Shield, Hammer, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnquiryForm } from "@/components/ghost/EnquiryForm";
import { LazySection } from "@/components/ghost/LazySection";
import { getSiteSettings, listPublishedServices } from "@/lib/tokens.functions";

export const Route = createFileRoute("/_public/")({
  head: () => ({
    meta: [
      { title: "Ghost Mods Tech — AI, Automation & Cyber-Engineered Software" },
      {
        name: "description",
        content:
          "Ghost Mods Tech builds production-grade web platforms, bots, AI automation and trains the engineers who wield them. Browse services and send a project brief — no account needed.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Ghost Mods Tech — AI, Automation & Cyber-Engineered Software" },
      {
        property: "og:description",
        content: "Browse our services and send a project brief. Real engineering, real delivery.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Ghost Mods Tech" },
      {
        name: "twitter:description",
        content: "Browse our services and send a project brief. No account needed.",
      },
    ],
  }),
  component: PublicHome,
});

function PublicHome() {
  const settingsFn = useServerFn(getSiteSettings);
  const servicesFn = useServerFn(listPublishedServices);
  const { data: settings } = useQuery({ queryKey: ["site-settings-public"], queryFn: () => settingsFn() });
  const { data: services = [] } = useQuery({ queryKey: ["services", "public"], queryFn: () => servicesFn() });
  const servicesRef = useRef<HTMLElement | null>(null);
  const [pulse, setPulse] = useState(false);

  function exploreServices() {
    const el = document.getElementById("services");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setPulse(true);
    setTimeout(() => setPulse(false), 1400);
  }

  function goEnquire() {
    const el = document.getElementById("enquire");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-24 lg:pt-28 lg:pb-32">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-mono tracking-wider text-muted-foreground mb-8 animate-fade-up">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              ACCEPTING NEW PROJECTS
            </div>

            <h1 className="text-fluid-hero font-bold mb-6 animate-fade-up" style={{ animationDelay: "60ms" }}>
              <span className="neon-text">{(settings as any)?.hero_title || "GHOST MODS"}</span>
              <br />
              <span className="text-foreground">TECH</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 animate-fade-up" style={{ animationDelay: "140ms" }}>
              {(settings as any)?.hero_subtitle ||
                "A next-generation engineering collective for AI, automation, and cyber-engineered software. Browse what we build — then send us your brief in two minutes."}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 animate-fade-up" style={{ animationDelay: "220ms" }}>
              <Button size="lg" onClick={exploreServices} className="glow-purple gap-2 font-medium">
                <Rocket className="h-4 w-4" /> Explore Services
              </Button>
              <Button size="lg" variant="outline" className="glass gap-2 hover-glow" onClick={goEnquire}>
                <Hammer className="h-4 w-4" /> Start a project
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section
        id="services"
        ref={servicesRef as any}
        className={`relative py-24 scroll-mt-20 transition-shadow duration-700 ${
          pulse ? "ring-2 ring-primary/60 shadow-[0_0_60px_-10px_hsl(var(--primary)/0.6)] rounded-3xl" : ""
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-mono tracking-[0.3em] text-primary mb-3">// SERVICES</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              What we <span className="neon-text">engineer</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Open any service for full details — features, pricing and answers — before you decide anything.
            </p>
          </div>

          {services.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center max-w-lg mx-auto">
              <Wrench className="h-8 w-8 text-primary mx-auto mb-3" />
              <p className="text-muted-foreground">
                Our service catalogue is being updated. Send an enquiry below and we'll reply directly.
              </p>
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
      </section>

      {/* ABOUT */}
      <LazySection minHeight={520}>
        <section className="relative py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-xs font-mono tracking-[0.3em] text-secondary mb-3">// ABOUT</p>
                <h2 className="text-4xl md:text-5xl font-bold mb-6">
                  Engineering the <span className="neon-text">future</span> of software
                </h2>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  Ghost Mods Tech is a hackademic collective of engineers, designers, and security
                  researchers building production-grade AI systems and teaching the craft along the way.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  We ship products, train operators, and harden infrastructure for teams that need
                  to move at the speed of intent.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { icon: Target, title: "Mission", body: "Equip builders with AI-native tooling and the skills to wield it." },
                  { icon: Eye, title: "Vision", body: "A world where every operator can build, automate, and secure their own stack." },
                  { icon: Zap, title: "Why us", body: "Battle-tested engineers shipping real products, not slideware." },
                  { icon: Shield, title: "Security first", body: "Every system we deliver is hardened by default." },
                ].map(({ icon: Icon, title, body }, i) => (
                  <div key={title} className="glass-card rounded-xl p-5 hover-glow animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                    <Icon className="h-6 w-6 text-primary mb-3" />
                    <h3 className="font-semibold mb-1.5">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </LazySection>

      {/* ENQUIRY */}
      <section id="enquire" className="relative py-20 scroll-mt-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-mono tracking-[0.3em] text-primary mb-3">// ENQUIRE</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Tell us about your <span className="neon-text">project</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              No account needed. Send your brief and we'll reply by email with a plan, timeline and
              quote. Prefer a walkthrough first? Ask for one in the message.
            </p>
          </div>
          <EnquiryForm />
          <p className="text-center text-xs text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link to="/auth" className="text-primary hover:underline">Sign in to your workspace</Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <LazySection minHeight={340}>
        <section className="relative py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="glass-card rounded-2xl p-10 md:p-14 text-center relative overflow-hidden">
              <div className="absolute inset-0 cyber-grid opacity-40 pointer-events-none" />
              <Sparkles className="h-8 w-8 text-primary mx-auto mb-4 relative" />
              <h3 className="text-3xl md:text-4xl font-bold mb-4 relative">
                Ready to <span className="neon-text">launch</span>?
              </h3>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto relative">
                Browse a service, send a brief, or sign in to explore the full platform.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 relative">
                <Button size="lg" onClick={goEnquire} className="glow-purple gap-2">
                  <Hammer className="h-4 w-4" /> Send a brief
                </Button>
                <Button asChild size="lg" variant="outline" className="glass gap-2 hover-glow">
                  <Link to="/auth"><Rocket className="h-4 w-4" /> Explore the platform</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </LazySection>
    </>
  );
}
