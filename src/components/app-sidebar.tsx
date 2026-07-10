import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { ENTERPRISE_TRANSITION } from "@/lib/animations";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Briefcase, Check, ChevronsUpDown,
  LogOut, Settings, Upload, BarChart3, Sliders, Webhook, Zap, Sparkles,
  Target, Map, Megaphone, MessageSquare, MessageCircle, ShieldCheck, Route as RouteIcon, GitBranch,
  Flame, Calendar as CalendarIcon, Award, Plug, Building, Rocket, Sun,
  Sun as SunIcon, ListChecks, CheckSquare, TrendingUp, Trophy, Repeat, DollarSign,
  Goal, GraduationCap, Workflow, FileInput, LineChart, Compass, MessagesSquare,
  Network, Headphones, Heart, Code2, Microscope, Bell, type LucideIcon,
  ChevronRight,
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

type NavTone = "primary" | "info" | "success" | "violet" | "accent" | "rose";
type NavEntry = {
  to: string;
  label: string;
  icon: LucideIcon;
  tone?: NavTone;
  managerOnly?: boolean;
};

type NavGroup = {
  label: string;
  items: NavEntry[];
};

const TONE_CLASS: Record<NavTone, string> = {
  primary: "text-muted-foreground group-data-[active=true]/menu-item:text-primary",
  info:    "text-muted-foreground group-data-[active=true]/menu-item:text-primary",
  success: "text-muted-foreground group-data-[active=true]/menu-item:text-primary",
  violet:  "text-muted-foreground group-data-[active=true]/menu-item:text-primary",
  accent:  "text-amber-500",
  rose:    "text-muted-foreground group-data-[active=true]/menu-item:text-primary",
};

const navigationGroups: NavGroup[] = [
  {
    label: "Comando Central",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tone: "accent" },
      { to: "/meu-dia", label: "Meu Dia", icon: Sun, tone: "accent" },
      { to: "/nba", label: "Ações Próximas", icon: Sparkles, tone: "accent" },
    ],
  },
  {
    label: "Vendas e Relacionamento",
    items: [
      { to: "/carteira", label: "Carteira Comercial", icon: Briefcase, tone: "info" },
      { to: "/leads", label: "Leads Comerciais", icon: Flame, tone: "accent" },
      { to: "/contacts", label: "Contatos e Pessoas", icon: Users, tone: "info" },
      { to: "/companies", label: "Contas B2B", icon: Building, tone: "info" },
      { to: "/oportunidades", label: "Oportunidades", icon: Target, tone: "accent" },
      { to: "/pipeline", label: "Pipeline Visual", icon: GitBranch, tone: "accent" },
    ],
  },
  {
    label: "Operação de Campo",
    items: [
      { to: "/calendar", label: "Agenda", icon: CalendarIcon, tone: "primary" },
      { to: "/geo-rota", label: "Visitas e Rotas", icon: RouteIcon, tone: "info" },
      { to: "/representantes", label: "Equipe de Vendas", icon: Award, tone: "success", managerOnly: true },
    ],
  },
  {
    label: "Comunicação Inteligente",
    items: [
      { to: "/whatsapp", label: "WhatsApp Inbox", icon: MessageCircle, tone: "success" },
      { to: "/site-chat", label: "Omnichannel", icon: MessagesSquare, tone: "success" },
    ],
  },
  {
    label: "Inteligência de Mercado",
    items: [
      { to: "/marketing-intel", label: "Marketing Intel", icon: Megaphone, tone: "violet" },
      { to: "/influencers", label: "Influencer ROI", icon: Trophy, tone: "accent" },
      { to: "/geo", label: "Geointeligência", icon: Map, tone: "info" },
      { to: "/inteligencia-comercial", label: "IA Comercial", icon: Sparkles, tone: "violet" },
    ],
  },
  {
    label: "Gestão do Grupo",
    items: [
      { to: "/multi-empresa", label: "Empresas e Filiais", icon: Building, tone: "primary", managerOnly: true },
      { to: "/dashboard-executivo", label: "Gestão Global", icon: LayoutDashboard, tone: "primary", managerOnly: true },
      { to: "/commissions", label: "Comissões", icon: DollarSign, tone: "success", managerOnly: true },
      { to: "/goals", label: "Metas & Ranking", icon: Trophy, tone: "accent", managerOnly: true },
      { to: "/forecast", label: "Previsão", icon: TrendingUp, tone: "info", managerOnly: true },
      { to: "/integrations", label: "ConnectHub ERP", icon: Plug, tone: "primary", managerOnly: true },
      { to: "/settings/alerts", label: "Alertas Inteligentes", icon: Bell, tone: "violet", managerOnly: true },
      { to: "/settings/organization", label: "Configurações", icon: Settings, tone: "primary", managerOnly: true },
    ],
  },


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

  const groups = useMemo(() => {
    return navigationGroups.map(group => ({
      ...group,
      items: group.items.filter(item => !item.managerOnly || canManage)
    })).filter(group => group.items.length > 0);
  }, [canManage]);

  const isItemActive = (to: string) =>
    path === to || (to !== "/dashboard" && path.startsWith(to + "/"));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent transition-all duration-200">
              <div className="relative flex h-8 w-full items-center justify-start overflow-hidden">
                <img 
                  src="https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/9fa2115e-e837-46f2-abac-57d602f8b76a/logo.png" 
                  alt="USE PATRIUM" 
                  className="h-6 w-auto object-contain"
                />
              </div>
              {!collapsed && (
                <div className="flex-1 text-left text-sm leading-tight min-w-0 ml-1">
                  <p className="truncate text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">Sales Intelligence</p>
                </div>
              )}
              {!collapsed && <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
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
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent className="py-1">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
                {group.label}
              </div>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavItem
                    key={`${group.label}:${item.to}:${item.label}`}
                    to={item.to}
                    label={item.label}
                    Icon={item.icon}
                    tone={item.tone ?? "primary"}
                    active={isItemActive(item.to)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
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
        
        {!collapsed && (
          <div className="px-4 py-3 mt-auto">
            <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">
              <span>Enterprise v3.0.4</span>
              <div className="h-1 w-1 rounded-full bg-emerald-500/50" />
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

type NavItemProps = { to: string; label: string; Icon: LucideIcon; active: boolean; tone: NavTone };
const NavItem = memo(function NavItem({ to, label, Icon, active, tone }: NavItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <Link
          to={to as any}
          preload="intent"
          className="nav-item group/nav relative"
        >
          {/* Indicador ativo — barra vertical à esquerda */}
          {active && (
            <motion.span
              layoutId="active-nav-indicator"
              className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
              transition={ENTERPRISE_TRANSITION}
            />
          )}
          <Icon
            className={`h-4 w-4 shrink-0 transition-colors duration-150 ${
              active ? "text-primary" : TONE_CLASS[tone]
            } group-hover/nav:text-primary`}
          />
          <span
            className={`font-medium transition-colors duration-150 ${
              active ? "text-foreground" : "text-sidebar-foreground"
            } group-hover/nav:text-foreground`}
          >
            {label}
          </span>
          <ChevronRight className="ml-auto h-3 w-3 opacity-0 transition-opacity duration-150 group-hover/nav:opacity-40" />
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});
