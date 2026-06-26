import { Link } from "@tanstack/react-router";
import { Github, Twitter, Linkedin, Send } from "lucide-react";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="relative mt-32 border-t border-border/40 glass">
      <div className="mx-auto max-w-7xl px-6 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2 space-y-4">
          <Logo />
          <p className="text-sm text-muted-foreground max-w-sm">
            Ghost Mods Tech — building the next generation of AI, automation, and cyber-engineered software.
          </p>
          <div className="flex gap-3">
            {[Github, Twitter, Linkedin, Send].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="grid place-items-center h-9 w-9 rounded-md glass hover-glow"
                aria-label="Social link"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold tracking-wider uppercase neon-text">Quick Links</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/" className="hover:text-foreground">Home</Link></li>
            <li><Link to="/" className="hover:text-foreground">Services</Link></li>
            <li><Link to="/" className="hover:text-foreground">Projects</Link></li>
            <li><Link to="/" className="hover:text-foreground">Contact</Link></li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold tracking-wider uppercase neon-text">Legal</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
            <li><a href="#" className="hover:text-foreground">Terms of Service</a></li>
            <li><a href="#" className="hover:text-foreground">Cookies</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/30 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Ghost Mods Tech. All systems operational.
      </div>
    </footer>
  );
}
