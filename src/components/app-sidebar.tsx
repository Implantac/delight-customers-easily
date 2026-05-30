import { memo, useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Building2, KanbanSquare, CheckSquare, Briefcase, Check, ChevronsUpDown, LogOut, Settings, Upload, BarChart3, Sliders, Webhook, Zap, Sparkles, AlertTriangle, Target, HeartPulse, DollarSign, Map, Package, MessageSquare, ShieldCheck, Trophy, Coins, Flame, Activity, Compass, PieChart, FileText, FileSignature, Grid3x3, History, Medal, Tag, Bookmark, Bell, Calendar as CalendarIcon, BookOpen, LifeBuoy, Inbox, Workflow, Repeat, Receipt, Wallet, ClipboardList, ClipboardCheck, PenLine, Route as RouteIcon, FormInput, Mail, Gift, Rocket, Files, Clock, Award, Boxes, Smile, Landmark, Truck, Plug, type LucideIcon } from "lucide-react";
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

type NavEntry = {
  to: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  managerOnly?: boolean;
};
type NavSection = { id: string; label: string; items: NavEntry[] };

const navSections: NavSection[] = [
  {
    id: "focus",
    label: "Visão & foco",
    items: [
      { to: "/command", label: "Comando", icon: Sparkles, shortcut: "G H" },
      { to: "/coaching", label: "Coaching", icon: Compass },
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "G D" },
      { to: "/reports", label: "Relatórios", icon: BarChart3, shortcut: "G R", managerOnly: true },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    items: [
      { to: "/contacts", label: "Contatos", icon: Users, shortcut: "G C" },
      { to: "/companies", label: "Empresas", icon: Building2, shortcut: "G E" },
      { to: "/lead-scoring", label: "Lead scoring", icon: Flame },
      { to: "/activities", label: "Atividades", icon: CheckSquare, shortcut: "G A" },
      { to: "/mytasks", label: "Minhas tarefas", icon: Inbox, shortcut: "G T" },
      { to: "/calendar", label: "Agenda", icon: CalendarIcon },
      { to: "/alerts", label: "Alertas", icon: AlertTriangle, shortcut: "G L" },
    ],
  },
  {
    id: "pipeline",
    label: "Pipeline & metas",
    items: [
      { to: "/pipeline", label: "Pipeline", icon: KanbanSquare, shortcut: "G P" },
      { to: "/forecast", label: "Previsão", icon: Target, shortcut: "G F" },
      { to: "/win-loss", label: "Win/Loss", icon: Trophy },
      { to: "/goals", label: "Metas & ranking", icon: Medal },
      { to: "/commissions", label: "Comissões", icon: Coins },
      { to: "/opportunity-map", label: "Mapa de oportunidades", icon: Map },
    ],
  },
  {
    id: "sales",
    label: "Vendas",
    items: [
      { to: "/products", label: "Produtos", icon: Package },
      { to: "/proposals", label: "Propostas", icon: FileSignature },
      { to: "/quotes", label: "Orçamentos", icon: FileSignature },
      { to: "/sales-orders", label: "Pedidos", icon: Package },
      { to: "/stock", label: "Estoque", icon: Boxes },
      { to: "/suppliers", label: "Fornecedores", icon: Truck },
    ],
  },
  {
    id: "finance",
    label: "Financeiro",
    items: [
      { to: "/finance", label: "Financeiro", icon: DollarSign },
      { to: "/subscriptions", label: "Assinaturas", icon: Repeat },
      { to: "/invoices", label: "Faturas", icon: Receipt },
      { to: "/banking", label: "Banco", icon: Landmark },
      { to: "/expenses", label: "Despesas", icon: Wallet },
      { to: "/approvals", label: "Aprovações", icon: ShieldCheck },
      { to: "/contracts", label: "Contratos", icon: FileSignature },
      { to: "/signatures", label: "Assinaturas eletrônicas", icon: PenLine },
    ],
  },
  {
    id: "marketing",
    label: "Marketing & engajamento",
    items: [
      { to: "/campaigns", label: "Campanhas", icon: Mail },
      { to: "/lead-forms", label: "Formulários", icon: FormInput },
      { to: "/referrals", label: "Indicações", icon: Gift },
      { to: "/loyalty", label: "Fidelidade", icon: Award },
      { to: "/segments", label: "Segmentação RFM", icon: PieChart },
      { to: "/cohorts", label: "Cohorts", icon: Grid3x3, managerOnly: true },
      { to: "/retention", label: "Retenção", icon: HeartPulse },
      { to: "/surveys", label: "Pesquisas", icon: Smile },
    ],
  },
  {
    id: "support",
    label: "Atendimento",
    items: [
      { to: "/chat", label: "Chat", icon: MessageSquare },
      { to: "/tickets", label: "Tickets", icon: LifeBuoy },
      { to: "/kb", label: "Base de conhecimento", icon: BookOpen },
      { to: "/templates", label: "Templates", icon: FileText },
      { to: "/sequences", label: "Sequências", icon: Workflow },
      { to: "/playbooks", label: "Playbooks", icon: ClipboardList },
      { to: "/routing", label: "Roteamento", icon: RouteIcon, managerOnly: true },
    ],
  },
  {
    id: "ops",
    label: "Operação",
    items: [
      { to: "/onboarding", label: "Onboarding", icon: Rocket },
      { to: "/documents", label: "Documentos", icon: Files },
      { to: "/time", label: "Horas", icon: Clock },
      { to: "/assets", label: "Ativos", icon: Boxes },
      { to: "/territories", label: "Territórios", icon: Map, managerOnly: true },
    ],
  },
  {
    id: "system",
    label: "Sistema",
    items: [
      { to: "/tags", label: "Tags", icon: Tag },
      { to: "/views", label: "Visualizações", icon: Bookmark },
      { to: "/notifications", label: "Notificações", icon: Bell },
      { to: "/data-quality", label: "Data quality", icon: ShieldCheck, managerOnly: true },
      { to: "/audit", label: "Auditoria", icon: History, managerOnly: true },
      { to: "/productivity", label: "Produtividade", icon: Activity, managerOnly: true },
      { to: "/integrations", label: "Integrações ERP", icon: Plug, managerOnly: true },
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

  const visibleSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items.filter((n) => !n.managerOnly || canManage),
        }))
        .filter((section) => section.items.length > 0),
    [canManage],
  );


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
        {visibleSections.map((section) => (
          <SidebarGroup key={section.id}>
            <SidebarGroupLabel className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <NavItem
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    Icon={item.icon}
                    active={path === item.to || (item.to !== "/dashboard" && path.startsWith(item.to + "/"))}
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

