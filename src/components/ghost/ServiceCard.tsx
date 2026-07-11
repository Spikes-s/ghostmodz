import { useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

export interface Service {
  slug:
    | "web"
    | "whatsapp"
    | "telegram"
    | "ai-automation"
    | "ui-ux"
    | "software"
    | "campus-coding"
    | "campus-hacking"
    | "cloud"
    | "cybersec"
    | "api"
    | "hosting";
  icon: LucideIcon;
  title: string;
  description: string;
}

/** Returns the target route or external URL for a service. */
export function serviceHref(
  slug: Service["slug"],
  settings?: { whatsapp_bot_url?: string | null; cloud_solutions_url?: string | null } | null,
): { kind: "internal" | "external"; url: string } {
  switch (slug) {
    case "web":
      return { kind: "internal", url: "/services/web-dev/new" };
    case "whatsapp":
      return { kind: "external", url: settings?.whatsapp_bot_url || "https://wa.me/" };
    case "telegram":
    case "ai-automation":
      return { kind: "internal", url: "/support" };
    case "ui-ux":
      return { kind: "internal", url: "/services/generic/ui-ux" };
    case "software":
      return { kind: "internal", url: "/services/generic/software" };
    case "campus-coding":
    case "campus-hacking":
      return { kind: "internal", url: "/services/campus/apply" };
    case "cloud":
      return { kind: "external", url: settings?.cloud_solutions_url || "#" };
    case "cybersec":
      return { kind: "internal", url: "/support" };
    case "api":
    case "hosting":
      return { kind: "internal", url: "/services/generic/hosting-api" };
  }
}

export function ServiceCard({
  service,
  index,
  settings,
}: {
  service: Service;
  index: number;
  settings?: { whatsapp_bot_url?: string | null; cloud_solutions_url?: string | null } | null;
}) {
  const Icon = service.icon;
  const navigate = useNavigate();

  function onClick() {
    const dest = serviceHref(service.slug, settings);
    if (dest.kind === "external") {
      if (dest.url && dest.url !== "#") window.open(dest.url, "_blank", "noopener,noreferrer");
      else navigate({ to: "/support" });
    } else {
      window.location.assign(dest.url);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative text-left glass-card rounded-xl p-6 hover-glow animate-fade-up transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/60"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="grid h-12 w-12 place-items-center rounded-lg glass neon-border mb-5 transition-transform group-hover:scale-110 group-hover:rotate-3">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{service.description}</p>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary opacity-70 group-hover:opacity-100 transition-opacity">
        Start now <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </span>
    </button>
  );
}
