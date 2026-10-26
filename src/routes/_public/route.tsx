import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { PublicHeader } from "@/components/ghost/PublicHeader";
import { Footer } from "@/components/ghost/Footer";
import { PageAmbience } from "@/components/ghost/PageAmbience";
import { pageTheme } from "@/lib/page-theme";

export const Route = createFileRoute("/_public")({
  ssr: false,
  component: PublicLayout,
});

function PublicLayout() {
  const location = useLocation();
  const theme = pageTheme(location.pathname);
  return (
    <div className={`relative min-h-svh flex flex-col ${theme.className}`}>
      <PageAmbience variant={theme.ambience} />
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
