export function BrandedLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="min-h-[40vh] w-full grid place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-primary/40 to-fuchsia-500/40 blur-md animate-pulse" />
          <div className="absolute inset-0 grid place-items-center font-mono text-xs font-bold text-primary">
            GM
          </div>
        </div>
        <div className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
          {label}
          <span className="inline-block w-6 text-left">
            <span className="animate-pulse">...</span>
          </span>
        </div>
      </div>
    </div>
  );
}
