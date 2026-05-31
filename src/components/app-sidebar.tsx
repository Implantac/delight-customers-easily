import { memo, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, KanbanSquare, CheckSquare, Briefcase, Check, ChevronsUpDown,
  ChevronRight, LogOut, Settings, Upload, BarChart3, Sliders, Webhook, Zap, Sparkles,
  AlertTriangle, Target, HeartPulse, Map, MapPin, Megaphone, Send, Package, MessageSquare, ShieldCheck, Trophy,
  Flame, Activity, Compass, PieChart, FileText, FileSignature, History, Bell,
  Calendar as CalendarIcon, BookOpen, LifeBuoy, Inbox, Workflow, Repeat, Receipt,
  Wallet, ClipboardList, PenLine, Route as RouteIcon, FormInput, Mail, Gift, Rocket,
  Files, Clock, Award, Boxes, Smile, Landmark, Truck, Plug, Building, GitBranch, Sun, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg, switchOrganization } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type NavEntry = {
  to: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  managerOnly?: boolean;
};
type NavSection = {
  id: string;
  label: string;
  items: NavEntry[];
  /** Quando true, o grupo começa colapsado (clutter reduzido por padrão). */
  defaultCollapsed?: boolean;
};

/**
 * Arquitetura comercial do USE CRM.
 * Regra: CRM ≠ ERP. Tudo que parece ERP fica sob "Integrações ERP (consulta)",
 * colapsado por padrão. A nav primária responde "o que faço para vender mais hoje?".
 *
 * Mapeamento dos 17 itens pedidos no briefing:
 *   Dashboard → /dashboard          Representantes → /goals (Onda 5 ganha rota dedicada)
 *   Carteira  → /carteira           Agenda         → /calendar
 *   Leads     → /marketing          WhatsApp       → /whatsapp
 *   Clientes  → /contacts           Marketing      → /campaigns
 *   Oportunidades → /opportunity-map (Onda 4 traz Central)
 *   Influencers → /influencers      Geointeligência → /geo
 *   IA Comercial → /ia-comercial    Relatórios      → /reports
 *   Integrações ERP → /integrations Empresas        → /companies
 *   Usuários  → /settings/organization (aba membros)
 *   Configurações → /settings/organization
 */
const navSections: NavSection[] = [
  {
    id: "principal",
    label: "Principal",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "G D" },
      { to: "/carteira", label: "Carteira Comercial", icon: Briefcase, shortcut: "G W" },
      { to: "/leads", label: "Leads", icon: Flame, shortcut: "G L" },
      { to: "/contacts", label: "Clientes", icon: Users, shortcut: "G C" },
      { to: "/oportunidades", label: "Oportunidades", icon: Target },
      { to: "/representantes", label: "Representantes", icon: Award, managerOnly: true },
    ],
  },
  {
    id: "relacionamento",
    label: "Relacionamento",
    items: [
      { to: "/calendar", label: "Agenda", icon: CalendarIcon },
      { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
      { to: "/campaigns", label: "Marketing", icon: Megaphone },
      { to: "/influencers", label: "Influencers", icon: Sparkles },
    ],
  },
  {
    id: "geo",
    label: "Geointeligência",
    items: [
      { to: "/geo", label: "Mapa Comercial", icon: MapPin, shortcut: "G M" },
      { to: "/geo-prospeccao", label: "Prospecção Inteligente", icon: Compass },
      { to: "/opportunity-map", label: "Oportunidades na Rota", icon: RouteIcon },
      { to: "/geo-cobertura", label: "Cobertura Territorial", icon: Map },
    ],
  },
  {
    id: "inteligencia",
    label: "Inteligência",
    items: [
      { to: "/ia-comercial", label: "IA Comercial", icon: Sparkles, shortcut: "G I" },
      { to: "/reports", label: "Relatórios", icon: BarChart3, shortcut: "G R", managerOnly: true },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    items: [
      { to: "/integrations", label: "Integrações ERP", icon: Plug, managerOnly: true },
      { to: "/settings/organization", label: "Empresas (workspaces)", icon: Building, managerOnly: true },
      { to: "/settings/organization", label: "Usuários", icon: Users, managerOnly: true },
      { to: "/settings/organization", label: "Configurações", icon: Settings },
    ],
  },
  {
    id: "comercial-extra",
    label: "Comercial — aprofundar",
    defaultCollapsed: true,
    items: [
      { to: "/meu-dia", label: "Meu Dia", icon: Sun, shortcut: "G Y" },
      { to: "/companies", label: "Contas (B2B)", icon: Building },
      { to: "/opportunity-map", label: "Mapa territorial", icon: Target },
      { to: "/pipeline", label: "Pipeline", icon: KanbanSquare, shortcut: "G P" },
      { to: "/forecast", label: "Previsão", icon: Target, shortcut: "G F" },
      { to: "/win-loss", label: "Win / Loss", icon: Trophy },
      { to: "/lead-scoring", label: "Lead scoring", icon: Flame },
      { to: "/retention", label: "Retenção & churn", icon: HeartPulse },
      { to: "/segments", label: "Segmentação RFM", icon: PieChart },
      { to: "/territories", label: "Territórios", icon: RouteIcon, managerOnly: true },
      { to: "/cohorts", label: "Cohorts", icon: PieChart, managerOnly: true },
      { to: "/benchmark", label: "Benchmark do grupo", icon: GitBranch, managerOnly: true },
      { to: "/productivity", label: "Produtividade", icon: Activity, managerOnly: true },
      { to: "/commissions", label: "Comissões", icon: Receipt },
      { to: "/goals", label: "Metas & ranking", icon: Award, managerOnly: true },
    ],
  },
  {
    id: "relacionamento-extra",
    label: "Relacionamento — aprofundar",
    defaultCollapsed: true,
    items: [
      { to: "/activities", label: "Atividades", icon: CheckSquare, shortcut: "G A" },
      { to: "/mytasks", label: "Minhas tarefas", icon: Inbox, shortcut: "G T" },
      { to: "/chat", label: "Chat interno", icon: MessageSquare },
      { to: "/marketing-intel", label: "Marketing Intel", icon: Megaphone, managerOnly: true },
      { to: "/templates", label: "Templates", icon: FileText },
      { to: "/sequences", label: "Sequências", icon: Workflow },
      { to: "/lead-forms", label: "Formulários / LPs", icon: FormInput },
      { to: "/referrals", label: "Indicações", icon: Gift },
      { to: "/surveys", label: "Pesquisas (NPS)", icon: Smile },
      { to: "/loyalty", label: "Fidelidade", icon: Award },
      { to: "/coaching", label: "Coaching IA", icon: Compass },
      { to: "/playbooks", label: "Playbooks", icon: ClipboardList },
      { to: "/command", label: "Plano do dia", icon: Sparkles, shortcut: "G H" },
      { to: "/alerts", label: "Alertas", icon: AlertTriangle },
    ],
  },
  {
    id: "atendimento",
    label: "Atendimento",
    defaultCollapsed: true,
    items: [
      { to: "/tickets", label: "Tickets", icon: LifeBuoy },
      { to: "/kb", label: "Base de conhecimento", icon: BookOpen },
      { to: "/routing", label: "Roteamento", icon: RouteIcon, managerOnly: true },
    ],
  },
  /**
   * ERP — somente consulta. Tudo aqui pertence ao ERP de origem.
   * O CRM apenas LÊ. Não criar telas de cadastro, edição ou fluxo fiscal aqui.
   */
  {
    id: "erp-readonly",
    label: "ERP — somente consulta",
    defaultCollapsed: true,
    items: [
      { to: "/products", label: "Produtos", icon: Package },
      { to: "/proposals", label: "Propostas", icon: FileSignature },
      { to: "/quotes", label: "Orçamentos", icon: FileSignature },
      { to: "/sales-orders", label: "Pedidos", icon: Package },
      { to: "/contracts", label: "Contratos", icon: FileSignature },
      { to: "/signatures", label: "Assinaturas eletrônicas", icon: PenLine },
      { to: "/subscriptions", label: "Assinaturas", icon: Repeat },
      { to: "/time", label: "Horas", icon: Clock },
      { to: "/settings/erp-agent", label: "Agente ERP local", icon: Plug, managerOnly: true },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    defaultCollapsed: true,
    items: [
      { to: "/notifications", label: "Notificações", icon: Bell },
      { to: "/onboarding", label: "Onboarding", icon: Rocket },
      { to: "/data-quality", label: "Data quality", icon: ShieldCheck, managerOnly: true },
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
        {visibleSections.map((section) => (
          <NavGroup key={section.id} section={section} path={path} collapsed={collapsed} />
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

type NavGroupProps = {
  section: NavSection;
  path: string;
  collapsed: boolean;
};

function NavGroup({ section, path, collapsed }: NavGroupProps) {
  const isItemActive = (to: string) =>
    path === to || (to !== "/dashboard" && path.startsWith(to + "/"));
  const hasActive = section.items.some((it) => isItemActive(it.to));
  // Se o grupo é "colapsável por padrão", abre automaticamente caso contenha rota ativa.
  const [open, setOpen] = useState(!section.defaultCollapsed || hasActive);
  const canCollapse = !!section.defaultCollapsed && !collapsed;

  return (
    <SidebarGroup>
      {canCollapse ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="group/label flex w-full items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 transition-transform duration-200",
              open && "rotate-90",
            )}
          />
          <span className="flex-1 text-left">{section.label}</span>
        </button>
      ) : (
        <SidebarGroupLabel className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {section.label}
        </SidebarGroupLabel>
      )}

      {(open || collapsed) && (
        <SidebarGroupContent>
          <SidebarMenu>
            {section.items.map((item) => (
              <NavItem
                key={`${section.id}:${item.to}:${item.label}`}
                to={item.to}
                label={item.label}
                Icon={item.icon}
                active={isItemActive(item.to)}
              />
            ))}

          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
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
