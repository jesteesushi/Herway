import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, MessagesSquare, Users, UserRound, Plus, ShieldCheck, LifeBuoy, Gavel } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Explore", icon: Compass },
  { to: "/community", label: "Community", icon: Users },
  { to: "/messages", label: "Messages", icon: MessagesSquare },
  { to: "/support", label: "Support", icon: LifeBuoy },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2 font-display text-lg font-semibold tracking-tight", className)}>
      <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 20V4M18 20V4M6 12c4 0 8-3 12-3" />
        </svg>
      </span>
      HerWay
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isModerator } = useAuth();
  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-card px-4 py-5 md:flex">
        <Wordmark className="px-2" />
        <Link
          to="/report"
          className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Plus className="size-4" /> Report an incident
        </Link>
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                isActive(n.to) && "bg-secondary text-secondary-foreground",
              )}
            >
              <n.icon className="size-4" /> {n.label}
            </Link>
          ))}
          {isModerator && (
            <Link
              to="/moderation"
              className={cn(
                "mt-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted",
                isActive("/moderation") && "bg-secondary text-secondary-foreground",
              )}
            >
              <Gavel className="size-4" /> Moderation
            </Link>
          )}
        </nav>
        <div className="mt-auto rounded-xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mb-1 size-4 text-primary" />
          HerWay is not an emergency service. In danger, call <a href="tel:999" className="font-semibold text-foreground underline">999</a>.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <Wordmark />
          <div className="flex items-center gap-1">
            {isModerator && (
              <Link to="/moderation" aria-label="Moderation" className="grid size-10 place-items-center rounded-full hover:bg-muted">
                <Gavel className="size-5" />
              </Link>
            )}
            <Link to="/support" aria-label="Support and emergency help" className="grid size-10 place-items-center rounded-full text-primary hover:bg-muted">
              <ShieldCheck className="size-5" />
            </Link>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col pb-20 md:pb-0">{children}</main>

        {/* Mobile tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {[NAV[0], NAV[1]].map((n) => (
            <TabLink key={n.to} to={n.to} label={n.label} Icon={n.icon} active={isActive(n.to)} />
          ))}
          <Link to="/report" aria-label="Report an incident" className="flex flex-col items-center justify-center py-1.5">
            <span className="-mt-5 grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-float">
              <Plus className="size-6" />
            </span>
            <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">Report</span>
          </Link>
          {[NAV[2], NAV[4]].map((n) => (
            <TabLink key={n.to} to={n.to} label={n.label} Icon={n.icon} active={isActive(n.to)} />
          ))}
        </nav>
      </div>
    </div>
  );
}

function TabLink({ to, label, Icon, active }: { to: string; label: string; Icon: typeof Compass; active: boolean }) {
  return (
    <Link
      to={to}
      className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground", active && "text-primary")}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10", className)}>{children}</div>;
}
