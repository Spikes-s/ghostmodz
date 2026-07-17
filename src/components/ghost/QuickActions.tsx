import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Zap, X, Sparkles, Hammer, Terminal as TerminalIcon, MessageCircle, Search, Bell } from "lucide-react";
import { openCommandPalette } from "./CommandPalette";

const ACTIONS = [
  { label: "Talk to Spikes", to: "/spikes", Icon: Sparkles, color: "from-fuchsia-500 to-purple-500" },
  { label: "Build Mode", to: "/build", Icon: Hammer, color: "from-cyan-500 to-blue-500" },
  { label: "Terminal", to: "/terminal", Icon: TerminalIcon, color: "from-emerald-500 to-teal-500" },
  { label: "Support", to: "/support", Icon: MessageCircle, color: "from-orange-500 to-pink-500" },
] as const;

export function QuickActions() {
  const [open, setOpen] = useState(false);
  const { location } = useRouterState();
  const hide =
    location.pathname.startsWith("/auth") ||
    location.pathname.startsWith("/reset-password") ||
    location.pathname.startsWith("/support") ||
    location.pathname.startsWith("/pay/");
  if (hide) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3">
      {open && (
        <div className="flex flex-col-reverse gap-2 animate-fade-in">
          {ACTIONS.map(({ label, to, Icon, color }) => (
            <Link
              key={to}
              to={to as any}
              onClick={() => setOpen(false)}
              className={`group flex items-center gap-2 pl-3 pr-4 py-2 rounded-full bg-gradient-to-r ${color} text-white shadow-lg shadow-black/40 text-sm font-medium hover:scale-105 transition-transform`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          ))}
          <button
            onClick={() => { setOpen(false); openCommandPalette(); }}
            className="flex items-center gap-2 pl-3 pr-4 py-2 rounded-full bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-lg text-sm font-medium hover:scale-105 transition-transform"
          >
            <Search className="h-4 w-4" />
            <span>Search (Ctrl+K)</span>
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Quick actions"
        className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-fuchsia-600 text-primary-foreground shadow-lg shadow-primary/40 ring-1 ring-primary/50 grid place-items-center hover:scale-110 transition-transform"
      >
        {open ? <X className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
      </button>
    </div>
  );
}
