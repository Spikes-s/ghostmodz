import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Clock, Sparkles, Hammer, Plug, FileText } from "lucide-react";
import { getContinueWorking } from "@/lib/search-index.functions";
import { Skeleton } from "@/components/ui/skeleton";

const iconMap: Record<string, any> = {
  Build: Hammer,
  API: Plug,
  Chat: Sparkles,
  Request: FileText,
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function ContinueWorking() {
  const fn = useServerFn(getContinueWorking);
  const { data, isLoading } = useQuery({
    queryKey: ["continue-working"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-6 pt-8">
        <Skeleton className="h-32 w-full rounded-2xl" />
      </section>
    );
  }

  if (!data?.latest) return null;

  const { latest, recent } = data;
  const LatestIcon = iconMap[latest.kind] ?? Hammer;

  return (
    <section className="mx-auto max-w-7xl px-6 pt-10 -mb-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-primary" />
        <h2 className="text-xs font-mono tracking-[0.3em] text-primary uppercase">Continue Working</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr_3fr]">
        <Link
          to={latest.href as any}
          className="group relative overflow-hidden glass-card border border-primary/30 hover:border-primary rounded-2xl p-6 transition-all hover:shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-fuchsia-500/10 opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <LatestIcon className="h-4 w-4 text-primary" />
              <span className="text-xs font-mono uppercase tracking-wider text-primary">{latest.kind}</span>
              <span className="text-xs text-muted-foreground ml-auto">{relTime(latest.updatedAt)}</span>
            </div>
            <h3 className="text-2xl font-bold mb-1 truncate">{latest.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{latest.subtitle}</p>
            <div className="inline-flex items-center gap-2 text-sm font-medium text-primary group-hover:gap-3 transition-all">
              Resume <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </Link>

        {recent.length > 1 && (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            {recent.slice(1, 5).map((r) => {
              const RIcon = iconMap[r.kind] ?? Hammer;
              return (
                <Link
                  key={`${r.kind}-${r.id}`}
                  to={r.href as any}
                  className="glass-card border border-border/40 hover:border-primary/60 rounded-xl p-3 flex items-start gap-3 transition-colors"
                >
                  <RIcon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.kind} · {relTime(r.updatedAt)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
