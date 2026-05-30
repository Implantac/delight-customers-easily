import { memo, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, KanbanSquare, CheckSquare, Briefcase, Check, ChevronsUpDown,
  ChevronRight, LogOut, Settings, Upload, BarChart3, Sliders, Webhook, Zap, Sparkles,
  AlertTriangle, Target, HeartPulse, Map, MapPin, Megaphone, Send, Package, MessageSquare, ShieldCheck, Trophy,
  Flame, Activity, Compass, PieChart, FileText, FileSignature, History, Bell,
  Calendar as CalendarIcon, BookOpen, LifeBuoy, Inbox, Workflow, Repeat, Receipt,
  Wallet, ClipboardList, PenLine, Route as RouteIcon, FormInput, Mail, Gift, Rocket,
  Files, Clock, Award, Boxes, Smile, Landmark, Truck, Plug, Building, GitBranch, type LucideIcon,
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
 * Nova arquitetura comercial — CRM como copiloto, não ERP.
 * Grupos colapsados por padrão = ruído menor, foco no que vende.
 */
const navSections: NavSection[] = [
  {
    id: "today",
    label: "Hoje",
    items: [
      { to: "/command", label: "Plano do dia", icon: Sparkles, shortcut: "G H" },
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "G D" },
      { to: "/alerts", label: "Alertas", icon: AlertTriangle, shortcut: "G L" },
    ],
  },
  {
    id: "wallet",
    label: "Carteira comercial",
    items: [
      { to: "/carteira", label: "Carteira 360", icon: Briefcase, shortcut: "G W" },
      { to: "/contacts", label: "Clientes", icon: Users, shortcut: "G C" },
      { to: "/companies", label: "Grupos / Filiais", icon: Building, shortcut: "G E" },
      { to: "/lead-scoring", label: "Lead scoring", icon: Flame },
      { to: "/retention", label: "Retenção & churn", icon: HeartPulse },
    ],
  },
  {
    id: "pipeline",
    label: "Pipeline & metas",
    items: [
      { to: "/pipeline", label: "Pipeline", icon: KanbanSquare, shortcut: "G P" },
      { to: "/forecast", label: "Previsão", icon: Target, shortcut: "G F" },
      { to: "/win-loss", label: "Win / Loss", icon: Trophy },
      { to: "/goals", label: "Metas & ranking", icon: Award },
    ],
  },
  {
    id: "relationship",
    label: "Relacionamento",
    items: [
      { to: "/calendar", label: "Agenda", icon: CalendarIcon },
      { to: "/activities", label: "Atividades", icon: CheckSquare, shortcut: "G A" },
      { to: "/mytasks", label: "Minhas tarefas", icon: Inbox, shortcut: "G T" },
    ],
  },
  {
    id: "omni",
    label: "Omnichannel",
    items: [
      { to: "/whatsapp", label: "WhatsApp multi-atendimento", icon: MessageSquare },
      { to: "/chat", label: "Chat interno", icon: MessageSquare },
      { to: "/campaigns", label: "E-mail & campanhas", icon: Mail },
      { to: "/templates", label: "Templates", icon: FileText },
      { to: "/sequences", label: "Sequências", icon: Workflow },
    ],
  },
  {
    id: "ai",
    label: "IA comercial",
    items: [
      { to: "/ia-comercial", label: "Agentes IA", icon: Sparkles, shortcut: "G I" },
      { to: "/coaching", label: "Coaching IA", icon: Compass },
      { to: "/playbooks", label: "Playbooks", icon: ClipboardList },
      { to: "/lead-forms", label: "Captura de leads", icon: FormInput },
      { to: "/referrals", label: "Indicações", icon: Gift },
    ],
  },
  {
    id: "geo",
    label: "Geointeligência",
    items: [
      { to: "/geo", label: "Mapa & Rotas IA", icon: MapPin, shortcut: "G M" },
      { to: "/opportunity-map", label: "Oportunidades", icon: Map },
      { to: "/territories", label: "Territórios", icon: RouteIcon, managerOnly: true },
      { to: "/segments", label: "Segmentação RFM", icon: PieChart },
    ],
  },
  {
    id: "marketing",
    label: "Marketing & Captação",
    items: [
      { to: "/marketing", label: "Inbox de leads", icon: Megaphone, shortcut: "G L" },
      { to: "/influencers", label: "Influenciadores", icon: Sparkles },
      { to: "/lead-forms", label: "Formulários / LPs", icon: FormInput },
      { to: "/campaigns", label: "Campanhas", icon: Send },
    ],
  },
  {
    id: "bi",
    label: "BI comercial",
    items: [
      { to: "/reports", label: "Relatórios", icon: BarChart3, shortcut: "G R", managerOnly: true },
      { to: "/benchmark", label: "Benchmark do grupo", icon: GitBranch, managerOnly: true },
      { to: "/cohorts", label: "Cohorts", icon: PieChart, managerOnly: true },
      { to: "/productivity", label: "Produtividade", icon: Activity, managerOnly: true },
      { to: "/surveys", label: "Pesquisas (NPS)", icon: Smile },
      { to: "/loyalty", label: "Fidelidade", icon: Award },
    ],
  },
  {
    id: "integrations",
    label: "Integrações & ERP",
    items: [
      { to: "/integrations", label: "ERP Connect Hub", icon: Plug, managerOnly: true },
      { to: "/onboarding", label: "Onboarding", icon: Rocket },
    ],
  },
  {
    id: "support",
    label: "Atendimento",
    defaultCollapsed: true,
    items: [
      { to: "/tickets", label: "Tickets", icon: LifeBuoy },
      { to: "/kb", label: "Base de conhecimento", icon: BookOpen },
      { to: "/routing", label: "Roteamento", icon: RouteIcon, managerOnly: true },
      { to: "/approvals", label: "Aprovações", icon: ShieldCheck },
    ],
  },
  /**
   * ERP (leitura) — módulos mantidos por compatibilidade mas que pertencem ao ERP.
   * Ficam colapsados por padrão para reforçar que o CRM NÃO é ERP.
   * Rotas não são removidas; só saem da navegação primária.
   */
  {
    id: "erp-readonly",
    label: "ERP (leitura)",
    defaultCollapsed: true,
    items: [
      { to: "/products", label: "Produtos", icon: Package },
      { to: "/proposals", label: "Propostas", icon: FileSignature },
      { to: "/quotes", label: "Orçamentos", icon: FileSignature },
      { to: "/sales-orders", label: "Pedidos", icon: Package },
      { to: "/contracts", label: "Contratos", icon: FileSignature },
      { to: "/signatures", label: "Assinaturas eletrônicas", icon: PenLine },
      { to: "/invoices", label: "Faturas", icon: Receipt },
      { to: "/finance", label: "Financeiro", icon: Landmark },
      { to: "/subscriptions", label: "Assinaturas", icon: Repeat },
      { to: "/banking", label: "Banco", icon: Landmark },
      { to: "/expenses", label: "Despesas", icon: Wallet },
      { to: "/commissions", label: "Comissões", icon: Receipt },
      { to: "/stock", label: "Estoque", icon: Boxes },
      { to: "/suppliers", label: "Fornecedores", icon: Truck },
      { to: "/assets", label: "Ativos", icon: Boxes },
      { to: "/time", label: "Horas", icon: Clock },
      { to: "/documents", label: "Documentos", icon: Files },
    ],
  },
  {
    id: "system",
    label: "Sistema",
    defaultCollapsed: true,
    items: [
      { to: "/notifications", label: "Notificações", icon: Bell },
      { to: "/data-quality", label: "Data quality", icon: ShieldCheck, managerOnly: true },
      { to: "/audit", label: "Auditoria", icon: History, managerOnly: true },
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
                key={item.to}
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
