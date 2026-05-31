import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { HealthScore } from "@/components/health-score";
import { NextActionBlock } from "@/components/next-action-block";
import { Timeline, type TimelineItem } from "@/components/timeline";
import {
  ArrowLeft, Globe, Trash2, Users, KanbanSquare, Clock, History as HistoryIcon,
  Plug, TrendingUp, Receipt, Package, MessageCircle, Mail, Phone, Sparkles, LayoutGrid,
} from "lucide-react";
import { Attachments } from "@/components/attachments";
import { TagPicker } from "@/components/tag-picker";
import { AuditHistory } from "@/components/audit-history";
import { AIInsights } from "@/components/ai-insights";
import { whatsappLink } from "@/lib/wa";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/companies/$id")({ component: CompanyDetail });

const BRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function CompanyDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", id],
    queryFn: async () => (await supabase.from("companies").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data: contacts } = useQuery({
    queryKey: ["company-contacts", id],
    queryFn: async () =>
      (await supabase.from("contacts").select("id, name, position, email, phone").eq("company_id", id)).data ?? [],
  });

  const { data: deals } = useQuery({
    queryKey: ["company-deals", id],
    queryFn: async () =>
      (await supabase
        .from("deals")
        .select("id, title, value, stage, expected_close, closed_at")
        .eq("company_id", id)
        .order("created_at", { ascending: false })).data ?? [],
  });

  const { data: invoices } = useQuery({
    queryKey: ["company-invoices", id],
    queryFn: async () =>
      (await supabase
        .from("invoices")
        .select("id, amount, status, issued_at, due_date, paid_at, number")
        .eq("company_id", id)
        .order("issued_at", { ascending: false })).data ?? [],
  });

  const { data: orderItems } = useQuery({
    queryKey: ["company-order-items", id],
    queryFn: async () =>
      (await supabase
        .from("order_items")
        .select("id, quantity, unit_price, occurred_at, product_id, products(name)")
        .eq("company_id", id)
        .order("occurred_at", { ascending: false })
        .limit(500)).data ?? [],
  });

  const { data: activities } = useQuery({
    queryKey: ["company-activities", id],
    queryFn: async () => {
      const { data: ds } = await supabase.from("deals").select("id").eq("company_id", id);
      const dealIds = (ds ?? []).map((d) => d.id);
      const cIds = (contacts ?? []).map((c) => c.id);
      let q = supabase.from("activities").select("id, title, type, due_date, completed");
      if (dealIds.length === 0 && cIds.length === 0) return [];
      if (dealIds.length > 0 && cIds.length > 0) {
        q = q.or(`deal_id.in.(${dealIds.join(",")}),contact_id.in.(${cIds.join(",")})`);
      } else if (dealIds.length > 0) {
        q = q.in("deal_id", dealIds);
      } else {
        q = q.in("contact_id", cIds);
      }
      const { data } = await q.order("due_date", { ascending: false, nullsFirst: false }).limit(50);
      return data ?? [];
    },
    enabled: !!contacts,
  });

  const { data: waMessages } = useQuery({
    queryKey: ["company-wa", id, contacts?.length ?? 0],
    enabled: !!contacts,
    queryFn: async () => {
      const cIds = (contacts ?? []).map((c) => c.id);
      if (cIds.length === 0) return [];
      const { data: convs } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .in("contact_id", cIds);
      const convIds = (convs ?? []).map((c) => c.id);
      if (convIds.length === 0) return [];
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("id, body, direction, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  // ============ Inteligência comercial derivada ============
  const kpis = useMemo(() => {
    const won = (deals ?? []).filter((d) => d.stage === "won");
    const open = (deals ?? []).filter((d) => d.stage !== "won" && d.stage !== "lost");
    const wonRevenue = won.reduce((s, d) => s + Number(d.value || 0), 0);
    const openPipeline = open.reduce((s, d) => s + Number(d.value || 0), 0);
    const ticket = won.length ? wonRevenue / won.length : 0;

    const lastWon = won
      .map((d) => d.closed_at)
      .filter(Boolean)
      .sort()
      .pop() as string | undefined;
    const lastPurchase = lastWon ?? (orderItems ?? [])[0]?.occurred_at ?? null;

    const overdueInvoices = (invoices ?? []).filter(
      (i) => i.status !== "paid" && new Date(i.due_date) < new Date(),
    );
    const overdueAmount = overdueInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);

    // Curva ABC dos produtos (top 5)
    const byProduct = new Map<string, { name: string; total: number; qty: number }>();
    for (const it of orderItems ?? []) {
      const key = it.product_id ?? "—";
      const name = (it as any).products?.name ?? "Produto sem nome";
      const total = Number(it.unit_price || 0) * Number(it.quantity || 0);
      const prev = byProduct.get(key) ?? { name, total: 0, qty: 0 };
      prev.total += total;
      prev.qty += Number(it.quantity || 0);
      byProduct.set(key, prev);
    }
    const products = [...byProduct.values()].sort((a, b) => b.total - a.total).slice(0, 5);
    const productsTotal = products.reduce((s, p) => s + p.total, 0);

    // Frequência: meses distintos com pedido ou won nos últimos 12
    const monthSet = new Set<string>();
    const cutoff = Date.now() - 365 * 24 * 3600 * 1000;
    for (const it of orderItems ?? []) {
      const t = new Date(it.occurred_at).getTime();
      if (t >= cutoff) monthSet.add(it.occurred_at.slice(0, 7));
    }
    for (const d of won) {
      if (!d.closed_at) continue;
      const t = new Date(d.closed_at).getTime();
      if (t >= cutoff) monthSet.add(d.closed_at.slice(0, 7));
    }

    return {
      wonRevenue, openPipeline, ticket, lastPurchase,
      overdueAmount, overdueCount: overdueInvoices.length,
      products, productsTotal,
      frequency: monthSet.size,
      wonCount: won.length, openCount: open.length,
    };
  }, [deals, invoices, orderItems]);

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["companies"] }); toast.success("Removida"); navigate({ to: "/companies" }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-4 md:p-8 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full max-w-2xl" /></div>;
  if (!company) return <div className="p-4 md:p-8"><p className="text-muted-foreground">Empresa não encontrada.</p></div>;

  const primaryContact = (contacts ?? [])[0];
  const waLink = primaryContact?.phone ? whatsappLink(primaryContact.phone) : null;

  return (
    <div className="page-container max-w-[1600px]">
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2 h-7 text-muted-foreground">
        <Link to="/companies"><ArrowLeft className="mr-1 h-3.5 w-3.5" />Carteira</Link>
      </Button>

      {/* ============ HERO — Command bar premium ============ */}
      <div className="surface-elevated relative overflow-hidden p-5 md:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] ring-1 ring-white/10">
              <span className="font-display text-xl font-semibold tracking-tight">
                {company.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[1.625rem] font-semibold leading-tight tracking-[-0.025em] md:text-[2rem]">
                  {company.name}
                </h1>
                {company.omie_id && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Plug className="h-2.5 w-2.5" /> ERP
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                {company.industry && <span>{company.industry}</span>}
                {company.size && <><span className="opacity-30">·</span><span>{company.size}</span></>}
                {company.website && (
                  <>
                    <span className="opacity-30">·</span>
                    <a href={company.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Globe className="h-3 w-3" />
                      {company.website.replace(/^https?:\/\//, "")}
                    </a>
                  </>
                )}
              </div>
              {/* Status pills derivadas da inteligência comercial */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {kpis.lastPurchase && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    <Clock className="h-2.5 w-2.5" />
                    Última compra {new Date(kpis.lastPurchase).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                )}
                {kpis.openCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    <KanbanSquare className="h-2.5 w-2.5" />
                    {kpis.openCount} aberta{kpis.openCount === 1 ? "" : "s"}
                  </span>
                )}
                {kpis.overdueCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-300">
                    <Receipt className="h-2.5 w-2.5" />
                    {kpis.overdueCount} em atraso
                  </span>
                )}
                {kpis.frequency >= 6 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    <Sparkles className="h-2.5 w-2.5" />
                    Cliente recorrente
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:shrink-0">
            {waLink && (
              <Button variant="outline" size="sm" asChild>
                <a href={waLink} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</a>
              </Button>
            )}
            {primaryContact?.email && (
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:${primaryContact.email}`}><Mail className="mr-1 h-4 w-4" />E-mail</a>
              </Button>
            )}
            {primaryContact?.phone && (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${primaryContact.phone}`}><Phone className="mr-1 h-4 w-4" />Ligar</a>
              </Button>
            )}
            <Button size="sm" asChild>
              <Link to="/pipeline"><KanbanSquare className="mr-1 h-4 w-4" />Nova oportunidade</Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => { if (confirm("Remover empresa?")) del.mutate(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ============ KPI strip ============ */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<TrendingUp className="h-4 w-4" />}
          label="Receita ganha"
          value={BRL(kpis.wonRevenue)}
          hint={`${kpis.wonCount} deal${kpis.wonCount === 1 ? "" : "s"} ganho${kpis.wonCount === 1 ? "" : "s"}`}
        />
        <Kpi
          icon={<KanbanSquare className="h-4 w-4" />}
          label="Pipeline aberto"
          value={BRL(kpis.openPipeline)}
          hint={`${kpis.openCount} oportunidade${kpis.openCount === 1 ? "" : "s"}`}
        />
        <Kpi
          icon={<Receipt className="h-4 w-4" />}
          label="Ticket médio"
          value={BRL(kpis.ticket)}
          hint={kpis.frequency ? `${kpis.frequency}× nos últimos 12m` : "sem histórico"}
        />
        <Kpi
          icon={<Clock className="h-4 w-4" />}
          label="Última compra"
          value={kpis.lastPurchase
            ? new Date(kpis.lastPurchase).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
            : "—"}
          hint={kpis.overdueCount
            ? `${kpis.overdueCount} fatura(s) em atraso · ${BRL(kpis.overdueAmount)}`
            : "em dia"}
          tone={kpis.overdueCount ? "warn" : undefined}
        />
      </div>

      {/* ============ Layout invertido: conteúdo principal à esquerda, painel de inteligência sticky à direita ============ */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ====== Coluna principal: ação comercial ====== */}
        <div className="min-w-0 space-y-6">

          {/* IA Comercial — sempre visível (briefing Fase 3) */}
          {primaryContact && (
            <NextActionBlock surface="contact" title="Próxima ação sugerida" limit={3} showRegenerate />
          )}

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" />Visão geral</TabsTrigger>
              <TabsTrigger value="deals" className="gap-1.5"><KanbanSquare className="h-3.5 w-3.5" />Oportunidades{deals?.length ? ` · ${deals.length}` : ""}</TabsTrigger>
              <TabsTrigger value="products" className="gap-1.5"><Package className="h-3.5 w-3.5" />Produtos</TabsTrigger>
              <TabsTrigger value="invoices" className="gap-1.5"><Receipt className="h-3.5 w-3.5" />Faturas{invoices?.length ? ` · ${invoices.length}` : ""}</TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5"><Clock className="h-3.5 w-3.5" />Timeline</TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />IA</TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5"><HistoryIcon className="h-3.5 w-3.5" />Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-6">
              {primaryContact ? (
                <AIInsights contactId={primaryContact.id} actions={["next_action", "summarize_contact"]} />
              ) : (
                <Card className="p-5 border-dashed">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" />
                    IA comercial
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Adicione um contato a esta empresa para receber sugestões de próxima ação geradas por IA.
                  </p>
                </Card>
              )}
              {(deals ?? []).length > 0 && (
                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <KanbanSquare className="h-4 w-4" />Oportunidades recentes
                    </h3>
                    <Button variant="ghost" size="sm" asChild><Link to="/pipeline">Pipeline →</Link></Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(deals ?? []).slice(0, 3).map((d) => (
                      <div key={d.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                        <p className="font-medium truncate">{d.title}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={d.stage === "won" ? "default" : d.stage === "lost" ? "destructive" : "secondary"}>{d.stage}</Badge>
                          <span className="text-muted-foreground tabular-nums">{BRL(Number(d.value))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="deals" className="mt-4">
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <KanbanSquare className="h-4 w-4" />Oportunidades ({deals?.length ?? 0})
                  </h3>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/pipeline">Ver pipeline →</Link>
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  {(deals ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem oportunidades registradas.</p>}
                  {deals?.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{d.title}</p>
                        {d.expected_close && (
                          <p className="text-xs text-muted-foreground">
                            prev. {new Date(d.expected_close).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={d.stage === "won" ? "default" : d.stage === "lost" ? "destructive" : "secondary"}>
                          {d.stage}
                        </Badge>
                        <span className="text-muted-foreground tabular-nums">{BRL(Number(d.value))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="products" className="mt-4">
              {kpis.products.length > 0 ? (
                <Card className="p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Package className="h-4 w-4" />Produtos comprados (top 5)
                  </h3>
                  <div className="mt-3 space-y-2">
                    {kpis.products.map((p, i) => {
                      const pct = kpis.productsTotal ? (p.total / kpis.productsTotal) * 100 : 0;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="truncate">{p.name}</span>
                            <span className="text-muted-foreground tabular-nums">{BRL(p.total)}</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-[var(--gradient-primary)] transition-all" style={{ width: `${Math.max(2, pct)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ) : (
                <Card className="p-5 border-dashed text-sm text-muted-foreground">
                  Nenhum pedido registrado para esta empresa.
                </Card>
              )}
            </TabsContent>

            <TabsContent value="invoices" className="mt-4">
              {(invoices ?? []).length > 0 ? (
                <Card className="p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Receipt className="h-4 w-4" />Faturamento
                  </h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {invoices!.map((inv) => {
                      const overdue = inv.status !== "paid" && new Date(inv.due_date) < new Date();
                      return (
                        <div key={inv.id} className="flex items-center justify-between rounded-md border p-3">
                          <div>
                            <p className="font-medium">
                              {inv.number ? `#${inv.number}` : "Fatura"}
                              <span className="ml-2 text-xs text-muted-foreground">
                                vence {new Date(inv.due_date).toLocaleDateString("pt-BR")}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={inv.status === "paid" ? "default" : overdue ? "destructive" : "secondary"}>
                              {inv.status === "paid" ? "paga" : overdue ? "vencida" : inv.status}
                            </Badge>
                            <span className="tabular-nums text-muted-foreground">{BRL(Number(inv.amount))}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ) : (
                <Card className="p-5 border-dashed text-sm text-muted-foreground">
                  Nenhuma fatura registrada.
                </Card>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              <Card className="p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4" />Timeline omnichannel</h3>
                <div className="mt-4">
                  <Timeline
                    emptyLabel="Sem eventos vinculados a este cliente."
                    items={[
                      ...(activities ?? []).map<TimelineItem>((a) => ({
                        id: a.id,
                        kind: "activity",
                        type: a.type,
                        title: a.title,
                        completed: a.completed,
                        date: a.due_date ?? new Date().toISOString(),
                        meta: a.type,
                      })),
                      ...(deals ?? [])
                        .filter((d) => d.stage === "won" && d.closed_at)
                        .map<TimelineItem>((d) => ({
                          id: `won-${d.id}`,
                          kind: "won",
                          title: `Ganhou: ${d.title}`,
                          date: d.closed_at!,
                          meta: BRL(Number(d.value || 0)),
                        })),
                      ...(deals ?? [])
                        .filter((d) => d.stage === "lost" && d.closed_at)
                        .map<TimelineItem>((d) => ({
                          id: `lost-${d.id}`,
                          kind: "lost",
                          title: `Perdeu: ${d.title}`,
                          date: d.closed_at!,
                          meta: BRL(Number(d.value || 0)),
                        })),
                      ...(invoices ?? []).map<TimelineItem>((inv) => {
                        const overdue = inv.status !== "paid" && new Date(inv.due_date) < new Date();
                        const isPaid = inv.status === "paid" && inv.paid_at;
                        return {
                          id: `inv-${inv.id}`,
                          kind: "invoice",
                          title: isPaid
                            ? `Fatura paga ${inv.number ? `#${inv.number}` : ""}`
                            : overdue
                            ? `Fatura em atraso ${inv.number ? `#${inv.number}` : ""}`
                            : `Fatura emitida ${inv.number ? `#${inv.number}` : ""}`,
                          date: isPaid ? inv.paid_at! : (inv.issued_at ?? inv.due_date),
                          meta: BRL(Number(inv.amount || 0)),
                        };
                      }),
                      ...(waMessages ?? []).map<TimelineItem>((m) => ({
                        id: `wa-${m.id}`,
                        kind: "whatsapp",
                        title: `${m.direction === "outbound" ? "Você → cliente" : "Cliente → você"}: ${m.body.slice(0, 80)}${m.body.length > 80 ? "…" : ""}`,
                        date: m.created_at,
                        meta: "WhatsApp",
                      })),
                    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 60)}
                  />
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="ai" className="mt-4">
              {primaryContact ? (
                <AIInsights contactId={primaryContact.id} actions={["next_action", "summarize_contact"]} />
              ) : (
                <Card className="p-5 border-dashed">
                  <p className="text-sm text-muted-foreground">
                    Adicione um contato a esta empresa para gerar insights de IA.
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card className="p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-4">
                  <HistoryIcon className="h-4 w-4" />Histórico de alterações
                </h3>
                <AuditHistory entityType="companies" entityId={company.id} />
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ====== Coluna direita: painel de inteligência sticky ====== */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <HealthScore companyId={company.id} />

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Contatos · {contacts?.length ?? 0}
              </h3>
            </div>
            <div className="mt-3 space-y-1.5">
              {(contacts ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Sem contatos vinculados.</p>
              )}
              {(contacts ?? []).slice(0, 5).map((c) => (
                <Link
                  key={c.id}
                  to="/contacts/$id"
                  params={{ id: c.id }}
                  className="group flex items-center justify-between rounded-md border border-transparent p-2 text-sm transition-colors hover:border-border hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium leading-tight">{c.name}</p>
                    {c.position && (
                      <p className="truncate text-[11px] text-muted-foreground">{c.position}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Etiquetas
            </h3>
            <div className="mt-2">
              <TagPicker entityType="company" entityId={company.id} />
            </div>
            {company.notes && (
              <>
                <h3 className="mt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Notas
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                  {company.notes}
                </p>
              </>
            )}
          </Card>

          <Attachments entityType="company" entityId={company.id} />
        </aside>
      </div>
    </div>
  );
}

type KpiProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "warn";
};

function Kpi({ icon, label, value, hint, tone }: KpiProps) {
  return (
    <Card className="kpi-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-card text-primary">
          {icon}
        </span>
      </div>
      <p
        data-slot="kpi-value"
        className="mt-3 font-display text-[1.5rem] font-semibold leading-none tracking-[-0.025em]"
      >
        {value}
      </p>
      {hint && (
        <p className={`mt-2 text-[11px] ${tone === "warn" ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          {hint}
        </p>
      )}
    </Card>
  );
}

