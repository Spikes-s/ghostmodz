import { useEffect, useRef, useState } from "react";
import ghostImg from "@/assets/ghost-intro.png";

const TOP_LINES = [
  "> sys.init --ghost-modz",
  "> loading kernel modules...",
  "> bypass.firewall(0x1A2F)",
  "> ACCESS GRANTED",
  "> welcome, operator",
];

const BOTTOM_LINES = [
  "$ ssh ghost@193.168.1.1",
  "$ decrypt payload.enc",
  "  ▓▓▓▓▓▓▓▓▓▓ 100%",
  "$ tunnel.open('mainframe')",
  "  [ok] link established",
];

function useTyped(lines: string[], startDelay = 0) {
  const [rendered, setRendered] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    let line = 0;
    let char = 0;
    const buf: string[] = lines.map(() => "");
    const tick = () => {
      if (cancelled) return;
      if (line >= lines.length) return;
      const target = lines[line];
      if (char <= target.length) {
        buf[line] = target.slice(0, char);
        setRendered([...buf]);
        char += 1;
        setTimeout(tick, 22 + Math.random() * 30);
      } else {
        line += 1;
        char = 0;
        setTimeout(tick, 180);
      }
    };
    const id = setTimeout(tick, startDelay);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [lines, startDelay]);
  return rendered;
}

function MatrixRain() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const fontSize = 14;
    let cols = Math.floor(w / fontSize);
    let drops = Array(cols).fill(1);
    const glyphs = "01アカサタナハマヤャラワGHOSTMODZ#$%@01".split("");

    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      cols = Math.floor(w / fontSize);
      drops = Array(cols).fill(1);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const draw = () => {
      ctx.fillStyle = "rgba(5, 3, 15, 0.08)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(193, 89, 240, 0.85)";
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
      for (let i = 0; i < drops.length; i++) {
        const text = glyphs[Math.floor(Math.random() * glyphs.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        ctx.fillStyle =
          Math.random() > 0.975
            ? "rgba(95, 232, 255, 0.95)"
            : "rgba(193, 89, 240, 0.75)";
        ctx.fillText(text, x, y);
        if (y > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full opacity-40 pointer-events-none"
    />
  );
}

function TerminalBox({
  lines,
  className,
  label,
}: {
  lines: string[];
  className: string;
  label: string;
}) {
  return (
    <div
      className={`absolute w-64 sm:w-80 rounded-md border border-primary/50 bg-black/70 backdrop-blur-sm shadow-[0_0_24px_rgba(193,89,240,0.35)] font-mono text-[11px] sm:text-xs ${className}`}
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-primary/30 bg-primary/10">
        <span className="h-2 w-2 rounded-full bg-red-500/80" />
        <span className="h-2 w-2 rounded-full bg-yellow-400/80" />
        <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
        <span className="ml-2 text-[10px] uppercase tracking-wider text-primary/80">
          {label}
        </span>
      </div>
      <div className="px-3 py-2 min-h-[112px] text-primary/90 space-y-0.5">
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre">
            {l}
            {i === lines.length - 1 && (
              <span className="inline-block w-2 h-3 ml-0.5 bg-primary animate-pulse align-middle" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GhostIntro({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const topLines = useTyped(TOP_LINES, 250);
  const bottomLines = useTyped(BOTTOM_LINES, 500);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 4200);
    const t2 = setTimeout(() => onDone(), 4900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] overflow-hidden bg-black transition-opacity duration-700 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <MatrixRain />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.9)_80%)]" />

      <TerminalBox
        lines={topLines}
        label="ghost@root"
        className="top-4 left-4 sm:top-8 sm:left-8 animate-fade-in"
      />
      <TerminalBox
        lines={bottomLines}
        label="tunnel.log"
        className="bottom-4 right-4 sm:bottom-8 sm:right-8 animate-fade-in"
      />

      <div className="relative w-full h-full flex items-center justify-center px-8">
        <img
          src={ghostImg}
          alt="Ghost Modz"
          draggable={false}
          className="max-w-[min(80vw,520px)] max-h-[80vh] object-contain animate-fade-in drop-shadow-[0_0_50px_rgba(193,89,240,0.55)]"
          style={{ animationDuration: "1.6s" }}
        />
      </div>

      <button
        onClick={() => {
          setLeaving(true);
          setTimeout(onDone, 500);
        }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-primary/60 hover:text-primary transition"
      >
        skip
      </button>
    </div>
  );
}
