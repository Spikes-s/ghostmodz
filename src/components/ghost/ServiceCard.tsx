import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

export interface Service {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function ServiceCard({ service, index }: { service: Service; index: number }) {
  const Icon = service.icon;
  return (
    <div
      className="group relative glass-card rounded-xl p-6 hover-glow animate-fade-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="grid h-12 w-12 place-items-center rounded-lg glass neon-border mb-5 transition-transform group-hover:scale-110 group-hover:rotate-3">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{service.description}</p>
      <button className="inline-flex items-center gap-1.5 text-sm font-medium text-primary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
        Learn more <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
