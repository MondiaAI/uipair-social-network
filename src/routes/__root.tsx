import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { FeedProvider } from "@/lib/feed-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { Toaster } from "@/components/ui/sonner";
import { installGlobalErrorLogger } from "@/lib/client-logger";

import appCss from "../styles.css?url";
import faviconUrl from "@/assets/favicon.svg?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

const SITE_URL = "https://project--6fc24415-9315-4655-9213-fe093e352f40.lovable.app";

export const Route = createRootRoute({
  head: ({ match }) => {
    const path = match.pathname || "/";
    const canonical = `${SITE_URL}${path === "/" ? "" : path}`;
    const ogImage = `${SITE_URL}/og-image.png`;
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#534AB7" },
        { name: "robots", content: "index, follow" },
        { title: "UiPair — Find your pair. Build your future." },
        { name: "description", content: "Connect, collaborate, and grow with university students worldwide." },
        { property: "og:title", content: "UiPair — Find your pair. Build your future." },
        { property: "og:description", content: "Connect, collaborate, and grow with university students worldwide." },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { property: "og:site_name", content: "UiPair" },
        { property: "og:image", content: ogImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:url", content: canonical },
        { name: "twitter:title", content: "UiPair — Find your pair. Build your future." },
        { name: "twitter:description", content: "Connect, collaborate, and grow with university students worldwide." },
        { name: "twitter:image", content: ogImage },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "canonical", href: canonical },
        { rel: "icon", type: "image/svg+xml", href: faviconUrl },
        { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
        { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
        { rel: "apple-touch-icon", sizes: "60x60", href: "/apple-touch-icon-60.png" },
        { rel: "apple-touch-icon", sizes: "76x76", href: "/apple-touch-icon-76.png" },
        { rel: "apple-touch-icon", sizes: "120x120", href: "/apple-touch-icon-120.png" },
        { rel: "apple-touch-icon", sizes: "152x152", href: "/apple-touch-icon-152.png" },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon-180.png" },
        { rel: "manifest", href: "/manifest.json" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => { installGlobalErrorLogger(); }, []);
  return (
    <AuthProvider>
      <NotificationsProvider>
        <FeedProvider>
          <Outlet />
          <Toaster />
        </FeedProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}
