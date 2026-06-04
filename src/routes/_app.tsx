import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPaletteTrigger } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsBell } from "@/components/notifications-bell";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { useGoToShortcuts } from "@/hooks/use-shortcuts";
import { useNotificationsRealtime } from "@/lib/use-notifications-realtime";
import { motion, AnimatePresence } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location.pathname });
  useGoToShortcuts();
  useNotificationsRealtime();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="text-sm">Carregando…</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/75 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 md:gap-3 md:px-4 shadow-[0_1px_0_0_color-mix(in_oklab,var(--accent)_18%,transparent)]">
            <SidebarTrigger className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" />
            <div className="h-5 w-px bg-border/80 hidden md:block" />
            <div className="flex-1 min-w-0">
              <CommandPaletteTrigger />
            </div>
            <NotificationsBell />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto pb-20 md:pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={location}
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="w-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
          <MobileBottomNav />
          <ShortcutsHelp />
          <PwaInstallBanner />
        </div>
      </div>
    </SidebarProvider>
  );
}
