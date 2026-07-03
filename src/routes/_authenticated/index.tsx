import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Code2, MessageSquare, Send, Bot, Palette, Cpu,
  GraduationCap, Shield, Cloud, Lock, Plug, Server,
  Hammer, Sparkles, Rocket, Target, Eye, Zap, ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ServiceCard, type Service } from "@/components/ghost/ServiceCard";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Ghost Mods Tech — Hackademic Platform" },
      { name: "description", content: "Premium futuristic AI development & cyber-engineering platform." },
    ],
  }),
  component: Home,
});

const SERVICES: Service[] = [
  { icon: Code2, title: "Custom Web Development", description: "Bespoke web platforms built with modern frameworks and edge infrastructure." },
  { icon: MessageSquare, title: "WhatsApp Bot Development", description: "Conversational WhatsApp bots with AI workflows and CRM integrations." },
  { icon: Send, title: "Telegram Bot Development", description: "Telegram bots for community ops, payments, and automation." },
  { icon: Bot, title: "AI Automation", description: "Agentic workflows that connect your tools and run autonomously 24/7." },
  { icon: Palette, title: "UI / UX Design", description: "Futuristic interfaces designed around your users and brand voice." },
  { icon: Cpu, title: "Software Development", description: "Production-grade software systems, APIs, and developer tooling." },
  { icon: GraduationCap, title: "Coding Courses", description: "Mentor-led programs to ship real projects from day one." },
  { icon: Shield, title: "Ethical Hacking Courses", description: "Hands-on offensive security training with live lab environments." },
  { icon: Cloud, title: "Cloud Solutions", description: "Scalable cloud architecture, IaC, and cost-optimized deployments." },
  { icon: Lock, title: "Cybersecurity Consulting", description: "Threat modeling, hardening, and incident response advisory." },
  { icon: Plug, title: "API Development", description: "Type-safe REST and GraphQL APIs with full observability." },
  { icon: Server, title: "Hosting & Deployment", description: "Zero-downtime deployment pipelines on global edge networks." },
];

function Home() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-28 lg:pt-32 lg:pb-40">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-mono tracking-wider text-muted-foreground mb-8 animate-fade-up">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              SYSTEM ONLINE — V1.0
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 animate-fade-up" style={{ animationDelay: "60ms" }}>
              <span className="neon-text">GHOST MODS</span>
              <br />
              <span className="text-foreground">TECH</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 animate-fade-up" style={{ animationDelay: "140ms" }}>
              A next-generation hackademic platform for AI, automation,
              and cyber-engineered software. Build at the edge of what's possible.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 animate-fade-up" style={{ animationDelay: "220ms" }}>
              <Button asChild size="lg" className="glow-purple gap-2 font-medium">
                <a href="#services"><Rocket className="h-4 w-4" /> Explore Services</a>
              </Button>
              <Button asChild size="lg" variant="outline" className="glass border-secondary/60 gap-2 hover-glow">
                <Link to="/build"><Hammer className="h-4 w-4" /> Build Mode</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="gap-2 glass">
                <Link to="/spikes"><Sparkles className="h-4 w-4" /> Talk to Spikes</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-mono tracking-[0.3em] text-primary mb-3">// SERVICES</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              What we <span className="neon-text">engineer</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From AI agents to ethical hacking labs — full-stack capability across the modern software stack.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {SERVICES.map((s, i) => (
              <ServiceCard key={s.title} service={s} index={i} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild size="lg" variant="outline" className="glass hover-glow gap-2">
              <Link to="/services">
                Browse all services <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>


      {/* ABOUT */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
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
                <div
                  key={title}
                  className="glass-card rounded-xl p-5 hover-glow animate-fade-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <Icon className="h-6 w-6 text-primary mb-3" />
                  <h3 className="font-semibold mb-1.5">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PLACEHOLDER PROMOS */}
      <section className="relative py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="glass-card rounded-2xl p-10 md:p-14 text-center relative overflow-hidden">
            <div className="absolute inset-0 cyber-grid opacity-40 pointer-events-none" />
            <h3 className="text-3xl md:text-4xl font-bold mb-4 relative">
              Ready to <span className="neon-text">launch</span>?
            </h3>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto relative">
              Talk to Spikes, our in-platform AI agent, or open the terminal to start building.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 relative">
              <Button asChild size="lg" className="glow-purple gap-2">
                <Link to="/spikes"><Sparkles className="h-4 w-4" /> Talk to Spikes</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="glass gap-2 hover-glow">
                <Link to="/build"><Hammer className="h-4 w-4" /> Open Build Mode</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
