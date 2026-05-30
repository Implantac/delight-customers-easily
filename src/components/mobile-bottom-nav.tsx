import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Briefcase, Users, Target, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// Bottom nav alinhado à arquitetura comercial (Onda 1/2).
// Foco: ir direto ao que gera receita — Dashboard, Carteira, Clientes,
// Oportunidades, WhatsApp.
const items = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/carteira", label: "Carteira", icon: Briefcase },
  { to: "/contacts", label: "Clientes", icon: Users },
  { to: "/oportunidades", label: "Oportun.", icon: Target },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
] as const;

export function MobileBottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur-xl shadow-[0_-4px_20px_-8px_rgb(0_0_0/0.08)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação principal"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon }) => {
          const active = path === to || (to !== "/dashboard" && path.startsWith(to));
          return (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-all duration-200 ease-out min-h-12",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground active:scale-95",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-[var(--gradient-primary)]"
                  />
                )}
                <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
                <span className="leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
