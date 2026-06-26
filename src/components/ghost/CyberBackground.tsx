export function CyberBackground() {
  // Deterministic particle positions (avoid SSR hydration drift)
  const particles = Array.from({ length: 30 }, (_, i) => ({
    left: (i * 37) % 100,
    top: (i * 53) % 100,
    delay: (i % 6) * 0.8,
    size: 2 + (i % 4),
  }));

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 cyber-grid" />
      <div className="absolute inset-0">
        {particles.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full animate-float"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: i % 2 ? "var(--color-neon-blue)" : "var(--color-neon-purple)",
              boxShadow: `0 0 ${p.size * 4}px currentColor`,
              color: i % 2 ? "var(--color-neon-blue)" : "var(--color-neon-purple)",
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
      <div
        className="absolute inset-x-0 h-px opacity-60"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--color-neon-cyan), transparent)",
          animation: "scan 8s linear infinite",
        }}
      />
    </div>
  );
}
