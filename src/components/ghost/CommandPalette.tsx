import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Home, Sparkles, Hammer, MessageCircle, Terminal as TerminalIcon,
  Shield, Bell, FolderKanban, Plug, FileText, Bot, Inbox, Search,
} from "lucide-react";
import { searchAll, type SearchHit } from "@/lib/search-index.functions";
import { useIsAdmin } from "@/lib/use-is-admin";

type PaletteContext = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

// Global singleton to allow Navbar search input to open the palette.
let paletteRef: PaletteContext | null = null;
export function openCommandPalette() {
  paletteRef?.setOpen(true);
}

const STATIC_PAGES = [
  { title: "Home", href: "/", Icon: Home },
  { title: "Spikes Bot", href: "/spikes", Icon: Sparkles },
  { title: "Build Mode", href: "/build", Icon: Hammer },
  { title: "Support", href: "/support", Icon: MessageCircle },
  { title: "Terminal", href: "/terminal", Icon: TerminalIcon },
  { title: "My Requests", href: "/account/requests", Icon: Inbox },
  { title: "Services", href: "/#services", Icon: FolderKanban },
];

const ADMIN_PAGES = [
  { title: "Admin Dashboard", href: "/admin", Icon: Shield },
  { title: "Admin · Users", href: "/admin/users", Icon: Shield },
  { title: "Admin · Support", href: "/admin/support", Icon: MessageCircle },
  { title: "Admin · Notifications", href: "/admin/settings", Icon: Bell },
  { title: "Admin · AI Settings", href: "/admin/ai-settings", Icon: Bot },
  { title: "Admin · API Projects", href: "/admin/api-projects", Icon: Plug },
];

function iconFor(type: SearchHit["type"]) {
  switch (type) {
    case "conversation": return Sparkles;
    case "project": return Hammer;
    case "api_project": return Plug;
    case "website_request": return FileText;
    case "notification": return Bell;
  }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const searchFn = useServerFn(searchAll);

  useEffect(() => {
    paletteRef = { open, setOpen };
    return () => { if (paletteRef?.setOpen === setOpen) paletteRef = null; };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced query
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data: hits = [] } = useQuery({
    queryKey: ["cmdk-search", debounced],
    queryFn: () => searchFn({ data: { q: debounced } }),
    enabled: open,
    staleTime: 30_000,
  });

  const grouped = useMemo(() => {
    const g: Record<string, SearchHit[]> = {};
    for (const h of hits) (g[h.type] ??= []).push(h);
    return g;
  }, [hits]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    // hash link -> full nav
    if (href.startsWith("/#")) {
      window.location.assign(href);
      return;
    }
    navigate({ to: href as any }).catch(() => window.location.assign(href));
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search projects, chats, pages…  (Ctrl/Cmd+K)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[70vh]">
        <CommandEmpty>No results. Try a different query.</CommandEmpty>

        <CommandGroup heading="Pages">
          {STATIC_PAGES.map(({ title, href, Icon }) => (
            <CommandItem key={href} value={`page ${title}`} onSelect={() => go(href)}>
              <Icon className="h-4 w-4 mr-2 text-primary" /> {title}
            </CommandItem>
          ))}
        </CommandGroup>

        {isAdmin && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Admin">
              {ADMIN_PAGES.map(({ title, href, Icon }) => (
                <CommandItem key={href} value={`admin ${title}`} onSelect={() => go(href)}>
                  <Icon className="h-4 w-4 mr-2 text-primary" /> {title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {Object.entries(grouped).map(([type, list]) => {
          const Icon = iconFor(type as SearchHit["type"]);
          const label =
            type === "conversation" ? "Chats"
            : type === "project" ? "Projects"
            : type === "api_project" ? "API Projects"
            : type === "website_request" ? "Requests"
            : "Notifications";
          return (
            <div key={type}>
              <CommandSeparator />
              <CommandGroup heading={label}>
                {list.map((h) => (
                  <CommandItem key={`${type}-${h.id}`} value={`${type} ${h.title} ${h.subtitle ?? ""}`} onSelect={() => go(h.href)}>
                    <Icon className="h-4 w-4 mr-2 text-primary" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{h.title}</span>
                      {h.subtitle && (
                        <span className="text-xs text-muted-foreground truncate">{h.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
