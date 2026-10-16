import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { AuthProvider } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Explore, Support, Soon } from "./pages";

const root = createRootRoute({ component: () => <AuthProvider><AppShell><Outlet /></AppShell></AuthProvider> });
const page = (path: string, component: () => JSX.Element) => createRoute({ getParentRoute: () => root, path, component });
const router = createRouter({
  routeTree: root.addChildren([
    page("/", Explore), page("/support", Support),
    page("/report", () => <Soon title="Report an incident" />), page("/community", () => <Soon title="Community" />),
    page("/messages", () => <Soon title="Messages" />), page("/profile", () => <Soon title="Profile" />),
    page("/moderation", () => <Soon title="Moderation" />),
  ]),
});
const rootEl = document.getElementById("root")!;
window.addEventListener("error", (e) => { if (!rootEl.childElementCount) rootEl.innerHTML = `<pre style="padding:16px;white-space:pre-wrap;font:13px monospace">HerWay failed to start:\n${e.message}</pre>`; });
createRoot(rootEl).render(<StrictMode><RouterProvider router={router} /></StrictMode>);
