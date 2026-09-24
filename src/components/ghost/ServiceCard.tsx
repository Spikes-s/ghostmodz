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
    | "hosting"
    | "downloader";
  icon: LucideIcon;
  title: string;
  description: string;
}

/** Slug of the in-depth CMS detail page for each service card. */
export const SERVICE_DETAIL_SLUG: Record<Service["slug"], string> = {
  web: "web-development",
  whatsapp: "whatsapp-bots",
  telegram: "telegram-bots",
  "ai-automation": "ai-automation",
  "ui-ux": "ui-ux",
  software: "software-development",
  "campus-coding": "coding-courses",
  "campus-hacking": "ethical-hacking",
  cloud: "cloud-hosting",
  cybersec: "cybersecurity",
  api: "api-dev",
  hosting: "hosting-deployment",
  downloader: "downloader",
};

export const CLOUD_HOST_URL = "https://Host.silvatechs.com";

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
      return { kind: "internal", url: "/cloud" };
    case "cybersec":
      return { kind: "internal", url: "/support" };
    case "api":
      return { kind: "internal", url: "/services/api-dev/new" };
    case "hosting":
      return { kind: "internal", url: "/services/generic/hosting-api" };
    case "downloader":
      return { kind: "internal", url: "/downloader" };
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
  const detailSlug = SERVICE_DETAIL_SLUG[service.slug];

  function go(dest: { kind: "internal" | "external"; url: string }) {
    if (dest.kind === "external") {
      if (dest.url && dest.url !== "#") window.open(dest.url, "_blank", "noopener,noreferrer");
      else navigate({ to: "/support" });
    } else {
      window.location.assign(dest.url);
    }
  }

  function openDetails() {
    if (service.slug === "cloud" || service.slug === "downloader") {
      window.location.assign(service.slug === "cloud" ? "/cloud" : "/downloader");
      return;
    }
    window.location.assign(`/services/${detailSlug}`);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDetails}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetails();
        }
      }}
      className="group relative text-left glass-card rounded-xl p-6 hover-glow animate-fade-up transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/60 cursor-pointer"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="grid h-12 w-12 place-items-center rounded-lg glass neon-border mb-5 transition-transform group-hover:scale-110 group-hover:rotate-3">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{service.description}</p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go(serviceHref(service.slug, settings));
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary opacity-80 group-hover:opacity-100 transition-opacity"
        >
          Start now <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openDetails();
          }}
          className="text-xs font-mono tracking-wider text-muted-foreground hover:text-secondary transition-colors"
        >
          {service.slug === "cloud" ? "VISIT HOST PORTAL" : "LEARN MORE"}
        </button>
      </div>
    </div>
  );
}

