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
import { PAGE_TRANSITION } from "@/lib/animations";

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
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/40 bg-background/60 px-4 backdrop-blur-xl md:gap-4 md:px-6">
            <SidebarTrigger className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" />
            <div className="h-4 w-px bg-border/60 hidden md:block" />
            <div className="flex-1 min-w-0">
              <CommandPaletteTrigger />
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <NotificationsBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto pb-20 md:pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={location}
                {...PAGE_TRANSITION}
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
