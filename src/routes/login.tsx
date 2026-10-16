import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { PageContainer } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect:
      typeof s["redirect"] === "string" &&
      s["redirect"].startsWith("/") &&
      !s["redirect"].startsWith("//")
        ? (s["redirect"] as string)
        : "/",
  }),
  head: () => ({
    meta: [
      { title: "Log in — HerWay" },
      { name: "description", content: "Sign in or create a pseudonymous HerWay account to report incidents and access community features." },
      { property: "og:title", content: "Log in — HerWay" },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  displayName: z.string().trim().min(2, "Display name must be at least 2 characters").max(40).optional(),
});

function LoginPage() {
  const { redirect: to } = Route.useSearch();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) void navigate({ to, replace: true });
  }, [session, to, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      email,
      password,
      displayName: mode === "up" ? displayName : undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form and try again.");
      return;
    }
    setBusy(true);
    if (mode === "up") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${to}`,
          data: { display_name: displayName.trim() },
        },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        toast.success("Check your email to confirm your account.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        toast.error("Email or password is incorrect.");
        return;
      }
    }
  }

  async function google() {
    if (to !== "/") sessionStorage.setItem("herway-next", to);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Google sign-in didn't work. Please try again.");
  }

  return (
    <PageContainer className="max-w-md">
      <h1 className="text-3xl font-semibold">
        {mode === "in" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your account is pseudonymous. Others only ever see your display name, never your email.
        Reports you submit never show who sent them.
      </p>

      <Button variant="outline" className="mt-6 h-11 w-full" onClick={google}>
        Continue with Google
      </Button>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "up" && (
          <div className="space-y-1.5">
            <Label htmlFor="dn">Display name</Label>
            <Input
              id="dn"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Not your real name"
              maxLength={40}
              autoComplete="nickname"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="em">Email</Label>
          <Input
            id="em"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Password</Label>
          <Input
            id="pw"
            type="password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "in" ? "Log in" : "Create account"}
        </Button>
      </form>

      <button
        className="mt-4 text-sm font-medium text-primary underline"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
      >
        {mode === "in" ? "New here? Create an account" : "Already have an account? Log in"}
      </button>
    </PageContainer>
  );
}
