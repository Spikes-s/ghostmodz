export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${dim} relative grid place-items-center rounded-md glass neon-border animate-pulse-glow`}>
        <svg viewBox="0 0 24 24" fill="none" className="h-2/3 w-2/3" aria-hidden>
          <path
            d="M12 2c-4 0-7 3-7 7v8a3 3 0 0 0 5 2.2A3 3 0 0 0 14 21a3 3 0 0 0 5-2v-8c0-4-3-9-7-9z"
            stroke="url(#g1)"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="9" cy="10" r="1.2" fill="var(--color-neon-cyan)" />
          <circle cx="15" cy="10" r="1.2" fill="var(--color-neon-cyan)" />
          <defs>
            <linearGradient id="g1" x1="0" x2="24" y1="0" y2="24">
              <stop stopColor="var(--color-neon-purple)" />
              <stop offset="1" stopColor="var(--color-neon-blue)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className={`${text} font-display font-bold tracking-wider neon-text`}>
        GHOST<span className="opacity-70">MODS</span>
      </div>
    </div>
  );
}
