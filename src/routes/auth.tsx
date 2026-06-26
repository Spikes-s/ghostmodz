import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/ghost/Logo";
import { CyberBackground } from "@/components/ghost/CyberBackground";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Ghost Mods Tech" },
      { name: "description", content: "Sign in or create an account to access Ghost Mods Tech." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Invalid email").max(255);
const passwordSchema = z.string().min(6, "At least 6 characters").max(72);

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // If already signed in, bounce home
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back.");
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const username = String(form.get("username") ?? "").trim();
    const fullName = String(form.get("full_name") ?? "").trim();
    if (!emailSchema.safeParse(email).success) return toast.error("Invalid email");
    if (!passwordSchema.safeParse(password).success)
      return toast.error("Password must be at least 6 characters");
    if (!username) return toast.error("Username required");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { username, full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. You're in.");
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error("Google sign-in failed");
    }
  }

  async function handleForgot() {
    const email = window.prompt("Enter your email to receive a reset link:");
    if (!email || !emailSchema.safeParse(email).success) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Reset link sent. Check your inbox.");
  }

  return (
    <div className="relative min-h-screen grid place-items-center px-6 py-12">
      <CyberBackground />
      <div className="w-full max-w-md glass-card rounded-2xl p-8 animate-fade-up">
        <div className="flex flex-col items-center gap-3 mb-6">
          <Logo size="lg" />
          <p className="text-sm text-muted-foreground text-center">
            Access the Ghost Mods Tech platform.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 mb-5 glass hover-glow border-border/60"
          onClick={handleGoogle}
          disabled={loading}
        >
          <GoogleIcon /> Continue with Google
        </Button>

        <div className="relative my-4 text-center text-xs text-muted-foreground">
          <span className="px-2 bg-background/30 relative z-10">or</span>
          <div className="absolute inset-x-0 top-1/2 h-px bg-border/50" />
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2 glass">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-3 mt-4">
              <Field name="email" label="Email" type="email" autoComplete="email" />
              <Field name="password" label="Password" type="password" autoComplete="current-password" />
              <div className="flex justify-between items-center text-xs">
                <label className="flex items-center gap-1.5 text-muted-foreground">
                  <input type="checkbox" name="remember" defaultChecked className="accent-primary" />
                  Remember me
                </label>
                <button type="button" onClick={handleForgot} className="text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <Button type="submit" className="w-full glow-purple" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-3 mt-4">
              <Field name="full_name" label="Full name" />
              <Field name="username" label="Username" />
              <Field name="email" label="Email" type="email" autoComplete="email" />
              <Field name="password" label="Password" type="password" autoComplete="new-password" />
              <Button type="submit" className="w-full glow-purple" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to the{" "}
          <Link to="/auth" className="underline">Terms</Link> and{" "}
          <Link to="/auth" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        className="glass border-border/60 focus-visible:ring-primary"
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M12 11v3.4h4.7c-.2 1.2-1.4 3.5-4.7 3.5-2.8 0-5.1-2.3-5.1-5.2S9.2 7.5 12 7.5c1.6 0 2.7.7 3.3 1.3l2.3-2.2C16.1 5.2 14.2 4.3 12 4.3 7.8 4.3 4.4 7.7 4.4 12s3.4 7.7 7.6 7.7c4.4 0 7.3-3.1 7.3-7.5 0-.5-.1-.9-.1-1.2H12z"/>
    </svg>
  );
}
