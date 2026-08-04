import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";

export function AcademyWelcome({ name, onDone }: { name?: string; onDone: () => void }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 2200);
    const t3 = setTimeout(onDone, 4200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-background/95 backdrop-blur-xl">
      <div className="cyber-grid absolute inset-0 opacity-30" />
      <div className="relative text-center px-6">
        <div
          className={`mx-auto mb-6 grid h-24 w-24 place-items-center rounded-2xl glass neon-border transition-all duration-1000 ${
            phase >= 1 ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
        >
          <GraduationCap className="h-12 w-12 text-primary animate-pulse-glow" />
        </div>
        <p
          className={`font-mono text-xs tracking-[0.4em] text-secondary transition-opacity duration-700 ${
            phase >= 1 ? "opacity-100" : "opacity-0"
          }`}
        >
          // INITIALIZING LEARNING CORE
        </p>
        <h1
          className={`mt-3 text-4xl md:text-5xl font-bold neon-text transition-all duration-1000 ${
            phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          Ghost Modz Academy
        </h1>
        <p
          className={`mt-4 text-muted-foreground transition-opacity duration-1000 ${
            phase >= 2 ? "opacity-100" : "opacity-0"
          }`}
        >
          Welcome{name ? `, ${name}` : ""}. Your access is active — your roadmap is being prepared.
        </p>
      </div>
    </div>
  );
}
