import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Building2, KanbanSquare, CheckSquare, Briefcase, Check, ChevronsUpDown, LogOut, Settings, Upload, BarChart3, Sliders, Webhook, Zap, Sparkles, AlertTriangle, Target, HeartPulse, DollarSign, Map, Package, MessageSquare, ShieldCheck, Trophy, Coins } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg, switchOrganization } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

const nav = [
  { to: "/command", label: "Comando", icon: Sparkles, shortcut: "G H", managerOnly: false },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "G D", managerOnly: false },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare, shortcut: "G P", managerOnly: false },
  { to: "/contacts", label: "Contatos", icon: Users, shortcut: "G C", managerOnly: false },
  { to: "/companies", label: "Empresas", icon: Building2, shortcut: "G E", managerOnly: false },
  { to: "/activities", label: "Atividades", icon: CheckSquare, shortcut: "G A", managerOnly: false },
  { to: "/alerts", label: "Alertas", icon: AlertTriangle, shortcut: "G L", managerOnly: false },
  { to: "/forecast", label: "Previsão", icon: Target, shortcut: "G F", managerOnly: false },
  { to: "/win-loss", label: "Win/Loss", icon: Trophy, shortcut: "", managerOnly: false },
  { to: "/commissions", label: "Comissões", icon: Coins, shortcut: "", managerOnly: false },
  { to: "/retention", label: "Retenção", icon: HeartPulse, shortcut: "", managerOnly: false },
  { to: "/finance", label: "Financeiro", icon: DollarSign, shortcut: "", managerOnly: false },
  { to: "/opportunity-map", label: "Mapa de Oportunidades", icon: Map, shortcut: "", managerOnly: false },
  { to: "/products", label: "Produtos", icon: Package, shortcut: "", managerOnly: false },
  { to: "/chat", label: "Chat", icon: MessageSquare, shortcut: "", managerOnly: false },
  { to: "/data-quality", label: "Data Quality", icon: ShieldCheck, shortcut: "", managerOnly: true },
  { to: "/reports", label: "Relatórios", icon: BarChart3, shortcut: "G R", managerOnly: true },
] as const;

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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--gradient-primary)] text-sidebar-primary-foreground shadow-[var(--shadow-glow)]">
                <Briefcase className="h-4 w-4" />
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left text-sm leading-tight min-w-0">
                    <p className="truncate font-semibold">{org?.name ?? "Lovable CRM"}</p>
                    <p className="truncate text-xs text-muted-foreground">Workspace</p>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
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
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.filter((n) => !n.managerOnly || canManage).map(({ to, label, icon: Icon }) => {
                const active = path === to || (to !== "/dashboard" && path.startsWith(to));
                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={label}>
                      <Link to={to}>
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-accent text-accent-foreground text-xs">{initials}</AvatarFallback>
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
