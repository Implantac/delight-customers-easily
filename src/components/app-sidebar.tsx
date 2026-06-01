import { memo, useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Briefcase, Check, ChevronsUpDown,
  LogOut, Settings, Upload, BarChart3, Sliders, Webhook, Zap, Sparkles,
  Target, Map, Megaphone, MessageSquare, ShieldCheck,
  Flame, Calendar as CalendarIcon, Award, Plug, Building, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg, switchOrganization } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

type NavEntry = {
  to: string;
  label: string;
  icon: LucideIcon;
  managerOnly?: boolean;
};

/**
 * USE CRM — Plataforma de Inteligência Comercial.
 * Sidebar enxuta, espelhando o briefing 1:1 (17 itens, em duas seções).
 *
 * REGRA ABSOLUTA: nada de ERP aqui. Nenhuma tela operacional/fiscal/financeira
 * aparece na navegação principal. O CRM apenas consome dados comerciais do ERP
 * via a entrada "Integrações ERP".
 */
const primaryNav: NavEntry[] = [
  { to: "/dashboard",                label: "Dashboard",          icon: LayoutDashboard },
  { to: "/dashboard-executivo",      label: "Dashboard Executivo", icon: Building, managerOnly: true },
  { to: "/carteira",                 label: "Carteira Comercial", icon: Briefcase },
  { to: "/leads",                    label: "Leads",              icon: Flame },
  { to: "/contacts",                 label: "Clientes",           icon: Users },
  { to: "/oportunidades",            label: "Oportunidades",      icon: Target },
  { to: "/representantes",           label: "Representantes",     icon: Award, managerOnly: true },
  { to: "/calendar",                 label: "Agenda",             icon: CalendarIcon },
  { to: "/whatsapp",                 label: "WhatsApp",           icon: MessageSquare },
  { to: "/campaigns",                label: "Marketing",          icon: Megaphone },
  { to: "/influencers",              label: "Influencers",        icon: Sparkles },
  { to: "/geo",                      label: "Geointeligência",    icon: Map },
  { to: "/inteligencia-comercial",   label: "IA Comercial",       icon: Sparkles },
  { to: "/inteligencia-comercial/qualidade-ia", label: "Qualidade da IA", icon: Sparkles, managerOnly: true },
  { to: "/reports",                  label: "Relatórios",         icon: BarChart3, managerOnly: true },
];

const adminNav: NavEntry[] = [
  { to: "/integrations",             label: "Integrações ERP",    icon: Plug, managerOnly: true },
  { to: "/companies",                label: "Empresas",           icon: Building },
  { to: "/settings/organization",    label: "Usuários",           icon: Users, managerOnly: true },
  { to: "/settings/organization",    label: "Configurações",      icon: Settings },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { org, memberships, orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const qc = useQueryClient();

  const initials = (user?.user_metadata?.full_name ?? user?.email ?? "?")
    .split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  const handleSwitch = async (id: string) => {
    if (!user || id === orgId) return;
    try {
      await switchOrganization(user.id, id);
      await qc.invalidateQueries();
      toast.success("Organização alterada");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const primary = useMemo(
    () => primaryNav.filter((n) => !n.managerOnly || canManage),
    [canManage],
  );
  const admin = useMemo(
    () => adminNav.filter((n) => !n.managerOnly || canManage),
    [canManage],
  );

  const isItemActive = (to: string) =>
    path === to || (to !== "/dashboard" && path.startsWith(to + "/"));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gradient-primary)] text-sidebar-primary-foreground shadow-[var(--shadow-glow)] ring-1 ring-white/10">
                <Sparkles className="h-4 w-4" />
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left text-sm leading-tight min-w-0">
                    <p className="truncate font-display font-semibold tracking-tight">{org?.name ?? "USE CRM"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">Inteligência Comercial</p>
                  </div>
                  <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Organizações</DropdownMenuLabel>
            {memberships.map((m) => (
              <DropdownMenuItem key={m.organization_id} onClick={() => handleSwitch(m.organization_id)}>
                <Briefcase className="mr-2 h-4 w-4" />
                <span className="flex-1 truncate">{m.organizations?.name ?? "—"}</span>
                {m.organization_id === orgId && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings/security"><ShieldCheck className="mr-2 h-4 w-4" />Segurança & MFA</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings/organization"><Settings className="mr-2 h-4 w-4" />Configurações</Link>
            </DropdownMenuItem>
            {canManage && (
              <>
                <DropdownMenuItem asChild>
                  <Link to="/settings/fields"><Sliders className="mr-2 h-4 w-4" />Campos personalizados</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings/import"><Upload className="mr-2 h-4 w-4" />Importar CSV</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings/webhooks"><Webhook className="mr-2 h-4 w-4" />Webhooks</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings/automations"><Zap className="mr-2 h-4 w-4" />Automações</Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {primary.map((item) => (
                <NavItem
                  key={`primary:${item.to}:${item.label}`}
                  to={item.to}
                  label={item.label}
                  Icon={item.icon}
                  active={isItemActive(item.to)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {admin.length > 0 && (
          <SidebarGroup>
            {!collapsed && (
              <div className="mx-2 mb-1 mt-2 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {admin.map((item) => (
                  <NavItem
                    key={`admin:${item.to}:${item.label}`}
                    to={item.to}
                    label={item.label}
                    Icon={item.icon}
                    active={isItemActive(item.to)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 text-left text-sm leading-tight min-w-0">
                  <p className="truncate font-medium">{user?.user_metadata?.full_name ?? "Usuário"}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{user?.user_metadata?.full_name ?? "Usuário"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

type NavItemProps = { to: string; label: string; Icon: LucideIcon; active: boolean };
const NavItem = memo(function NavItem({ to, label, Icon, active }: NavItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <Link to={to as any} preload="intent">
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});
