import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, KanbanSquare, Users, CheckSquare, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/contacts", label: "Contatos", icon: Users },
  { to: "/activities", label: "Tarefas", icon: CheckSquare },
  { to: "/reports", label: "Relatórios", icon: BarChart3 },
] as const;

export function MobileBottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon }) => {
          const active = path === to || (to !== "/dashboard" && path.startsWith(to));
          return (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
