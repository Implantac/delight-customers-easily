import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { ENTERPRISE_TRANSITION } from "@/lib/animations";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Briefcase, Check, ChevronsUpDown,
  LogOut, Settings, Upload, BarChart3, Sliders, Webhook, Zap, Sparkles,
  Target, Map, Megaphone, MessageSquare, ShieldCheck, Route as RouteIcon, GitBranch,
  Flame, Calendar as CalendarIcon, Award, Plug, Building, Rocket, Sun,
  Sun as SunIcon, ListChecks, CheckSquare, TrendingUp, Trophy, Repeat, DollarSign,
  Goal, GraduationCap, Workflow, FileInput, LineChart, Compass, MessagesSquare,
  Network, type LucideIcon,
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
    label: "Crescimento",
    items: [
      { to: "/dashboard", label: "Central de Crescimento", icon: Sparkles, tone: "accent" },
      { to: "/oportunidades", label: "Oportunidades", icon: Target, tone: "accent" },
      { to: "/inteligencia-comercial", label: "IA Comercial", icon: Sparkles, tone: "violet" },
    ],
  },
  {
    label: "Relacionamento",
    items: [
      { to: "/carteira", label: "Carteira Comercial", icon: Briefcase, tone: "info" },
      { to: "/contacts", label: "Clientes", icon: Users, tone: "info" },
      { to: "/leads", label: "Leads", icon: Flame, tone: "accent" },
    ],
  },
  {
    label: "Equipe",
    items: [
      { to: "/representantes", label: "Representantes", icon: Award, tone: "success", managerOnly: true },
      { to: "/calendar", label: "Agenda", icon: CalendarIcon, tone: "primary" },
      { to: "/geo-rota", label: "Visitas e Rotas", icon: RouteIcon, tone: "info" },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare, tone: "success" },
      { to: "/site-chat", label: "Omnichannel", icon: MessagesSquare, tone: "success" },
      { to: "/chat", label: "Chat Interno", icon: MessagesSquare, tone: "success" },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { to: "/geo", label: "Geointeligência", icon: Map, tone: "info" },
      { to: "/reports", label: "Relatórios", icon: BarChart3, tone: "info", managerOnly: true },
      { to: "/forecast", label: "Forecast", icon: TrendingUp, tone: "info", managerOnly: true },
    ],
  },
  {
    label: "Integrações",
    items: [
      { to: "/integrations", label: "ConnectHub", icon: Plug, tone: "primary", managerOnly: true },
    ],
  },
  {
    label: "Administração",
    items: [
      { to: "/companies", label: "Empresas", icon: Building, tone: "primary" },
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
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm ring-1 ring-white/15">
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
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
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
          className="relative transition-all duration-300 hover:pl-5 group"
        >
          <Icon className={`h-4 w-4 transition-all duration-300 group-hover:scale-110 ${TONE_CLASS[tone]}`} />
          <span className="transition-all duration-300 group-hover:tracking-tight">{label}</span>
          {active && (
            <motion.div 
              layoutId="active-nav"
              className="absolute left-1 h-1 w-1 rounded-full bg-primary"
              transition={ENTERPRISE_TRANSITION}
            />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});
