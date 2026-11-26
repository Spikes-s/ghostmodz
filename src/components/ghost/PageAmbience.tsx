import { useEffect, useState } from "react";
import type { AmbienceVariant } from "@/lib/page-theme";
import { CircuitScene } from "@/components/ghost/CircuitScene";

/**
 * PageAmbience — page-specific background environment.
 *
 * - Uses the theme's --ambience-a / --ambience-b accent tokens.
 * - Deterministic positions (no SSR/hydration drift).
 * - Pauses when the tab is hidden.
 * - Renders motion-free on prefers-reduced-motion.
 * - Reduces particle count on phones / coarse pointers.
 */

const seeded = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const TINTS: Record<AmbienceVariant, string> = {
  gateway:
    "radial-gradient(ellipse 80% 55% at 50% -10%, oklch(0.3 0.18 290 / 0.4), transparent 70%), radial-gradient(ellipse 60% 50% at 100% 100%, oklch(0.3 0.18 240 / 0.28), transparent 70%)",
  lab: "linear-gradient(180deg, oklch(0.16 0.03 230 / 0.55), oklch(0.13 0.02 230 / 0.25)), radial-gradient(ellipse 60% 40% at 50% 0%, oklch(0.3 0.1 220 / 0.25), transparent 70%)",
  studio:
    "radial-gradient(ellipse 70% 50% at 20% 0%, oklch(0.3 0.12 300 / 0.35), transparent 70%), radial-gradient(ellipse 60% 45% at 90% 90%, oklch(0.3 0.1 220 / 0.3), transparent 70%)",
  command: "radial-gradient(ellipse 80% 60% at 50% -10%, oklch(0.25 0.1 270 / 0.38), transparent 70%)",
  ops: "radial-gradient(ellipse 70% 50% at 50% -10%, oklch(0.22 0.06 265 / 0.35), transparent 70%)",
  console: "radial-gradient(ellipse 80% 55% at 50% -10%, oklch(0.2 0.06 190 / 0.35), transparent 70%)",
  portal: "radial-gradient(ellipse 70% 50% at 50% 0%, oklch(0.28 0.14 300 / 0.4), transparent 70%)",
  editorial: "radial-gradient(ellipse 70% 45% at 50% 0%, oklch(0.2 0.05 300 / 0.25), transparent 70%)",
};

function Particles({ count }: { count: number }) {
  return (
    <div className="absolute inset-0">
      {Array.from({ length: count }, (_, i) => {
        const a = seeded(i + 1);
        const b = seeded(i + 51);
        const c = seeded(i + 101);
        const size = 1.5 + c * 2.5;
        const color = i % 3 === 0 ? "var(--ambience-b)" : "var(--ambience-a)";
        return (
          <span
            key={i}
            className="ambience-anim absolute rounded-full"
            style={{
              left: `${a * 100}%`,
              top: `${b * 100}%`,
              width: `${size}px`,
              height: `${size}px`,
              background: color,
              color,
              boxShadow: `0 0 ${size * 5}px currentColor`,
              opacity: 0.3 + c * 0.4,
              animation: `float-particle ${6 + c * 6}s ease-in-out ${c * 4}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

function Stars({ count }: { count: number }) {
  return (
    <div className="absolute inset-0">
      {Array.from({ length: count }, (_, i) => {
        const a = seeded(i + 7);
        const b = seeded(i + 71);
        const c = seeded(i + 171);
        const size = 1 + c * 1.8;
        return (
          <span
            key={i}
            className="ambience-anim absolute rounded-full bg-white"
            style={{
              left: `${a * 100}%`,
              top: `${b * 100}%`,
              width: `${size}px`,
              height: `${size}px`,
              opacity: 0.15 + c * 0.5,
              animation: `twinkle ${3 + c * 5}s ease-in-out ${c * 6}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

function Waveform() {
  const bars = 48;
  return (
    <div className="absolute inset-x-0 bottom-0 flex h-24 items-end justify-center gap-[3px] opacity-25 px-2">
      {Array.from({ length: bars }, (_, i) => {
        const c = seeded(i + 13);
        return (
          <span
            key={i}
            className="ambience-anim w-1 rounded-t-sm"
            style={{
              height: `${18 + c * 80}%`,
              background: i % 2 ? "var(--ambience-b)" : "var(--ambience-a)",
              transformOrigin: "bottom",
              animation: `wave ${1.6 + c * 1.6}s ease-in-out ${c * 1.4}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

function Orbs({ count = 3 }: { count?: number }) {
  return (
    <div className="absolute inset-0">
      {Array.from({ length: count }, (_, i) => {
        const a = seeded(i + 3);
        const b = seeded(i + 33);
        const size = 280 + seeded(i + 63) * 320;
        const color = i % 2 ? "var(--ambience-b)" : "var(--ambience-a)";
        return (
          <span
            key={i}
            className="ambience-anim absolute rounded-full blur-[90px]"
            style={{
              left: `${a * 80 - 10}%`,
              top: `${b * 80 - 10}%`,
              width: `${size}px`,
              height: `${size}px`,
              background: `color-mix(in oklab, ${color} 22%, transparent)`,
              animation: `drift ${22 + i * 9}s ease-in-out ${i * 3}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

function GridLayer({ cell = 60 }: { cell?: number }) {
  return (
    <div
      className="absolute inset-0 cyber-grid"
      style={{ backgroundSize: `${cell}px ${cell}px` }}
    />
  );
}

export function PageAmbience({ variant }: { variant: AmbienceVariant }) {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactMq = window.matchMedia("(max-width: 768px), (pointer: coarse)");
    const sync = () => {
      setReduced(reduceMq.matches);
      setCompact(compactMq.matches);
    };
    sync();
    reduceMq.addEventListener("change", sync);
    compactMq.addEventListener("change", sync);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      reduceMq.removeEventListener("change", sync);
      compactMq.removeEventListener("change", sync);
    };
  }, []);

  const animate = !reduced;

  return (
    <div
      aria-hidden="true"
      data-ambience-paused={paused || reduced ? "true" : "false"}
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Theme tint */}
      <div className="absolute inset-0" style={{ background: TINTS[variant] }} />
      {variant !== "portal" && variant !== "editorial" && <CircuitScene />}

      {variant === "gateway" && animate && (
        <>
          <GridLayer />
          <Particles count={compact ? 12 : 26} />
          <div
            className="absolute inset-x-0 h-px opacity-60 ambience-anim"
            style={{
              background: "linear-gradient(90deg, transparent, var(--ambience-b), transparent)",
              animation: "scan 8s linear infinite",
            }}
          />
        </>
      )}

      {variant === "lab" && animate && (
        <>
          <div
            className="absolute inset-0 opacity-20 ambience-anim"
            style={{
              background:
                "repeating-linear-gradient(0deg, transparent 0 3px, color-mix(in oklab, var(--ambience-a) 14%, transparent) 3px 4px)",
              animation: "crt 0.35s linear infinite",
            }}
          />
          <Particles count={compact ? 8 : 16} />
          <Waveform />
          <div
            className="absolute inset-x-0 h-16 opacity-30 ambience-anim"
            style={{
              background:
                "linear-gradient(180deg, transparent, color-mix(in oklab, var(--ambience-a) 25%, transparent), transparent)",
              animation: "scan 7s linear infinite",
            }}
          />
        </>
      )}

      {variant === "studio" && (
        <>
          <Orbs count={compact ? 2 : 3} />
          {animate && <Particles count={compact ? 8 : 14} />}
        </>
      )}

      {variant === "command" && (
        <>
          <Stars count={compact ? 26 : 52} />
          {animate && <Particles count={compact ? 6 : 10} />}
        </>
      )}

      {variant === "ops" && (
        <>
          <GridLayer cell={28} />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 55% 40% at 50% 0%, color-mix(in oklab, var(--ambience-a) 14%, transparent), transparent 70%)",
            }}
          />
        </>
      )}

      {variant === "console" && animate && (
        <>
          <GridLayer cell={44} />
          <div
            className="absolute inset-0 opacity-15 ambience-anim"
            style={{
              background:
                "repeating-linear-gradient(0deg, transparent 0 3px, color-mix(in oklab, var(--ambience-a) 12%, transparent) 3px 4px)",
              animation: "crt 0.4s linear infinite",
            }}
          />
          <div
            className="absolute inset-x-0 h-10 opacity-30 ambience-anim"
            style={{
              background:
                "linear-gradient(180deg, transparent, color-mix(in oklab, var(--ambience-a) 30%, transparent), transparent)",
              animation: "scan 9s linear infinite",
            }}
          />
        </>
      )}

      {variant === "portal" && <Orbs count={2} />}

      {variant === "editorial" && (
        <div
          className="absolute inset-x-0 top-0 h-64"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--ambience-a) 10%, transparent), transparent)",
          }}
        />
      )}
    </div>
  );
}
