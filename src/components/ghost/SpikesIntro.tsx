import { useEffect, useState } from "react";

/** Cinematic Spikes intro — fades out after ~2.6s. */
export function SpikesIntro({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "out">("in");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("out"), 2000);
    const t2 = setTimeout(onDone, 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-500"
      style={{ opacity: phase === "out" ? 0 : 1, pointerEvents: phase === "out" ? "none" : "auto" }}
    >
      {/* Neon rings */}
      <div className="relative h-72 w-72">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full border border-primary/60"
            style={{
              animation: `spikes-ring 2.4s ease-out ${i * 0.18}s infinite`,
              boxShadow: "0 0 40px var(--color-neon-purple), inset 0 0 40px var(--color-neon-blue)",
            }}
          />
        ))}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="font-display text-5xl font-black neon-text animate-pulse-glow">
            SPIKES
          </div>
          <div className="mt-2 text-[10px] font-mono tracking-[0.4em] text-secondary">
            INITIALIZING NEURAL CORE
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spikes-ring {
          0%   { transform: scale(0.4); opacity: 0; }
          40%  { opacity: 1; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
