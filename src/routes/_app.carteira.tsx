import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getCommercialWallet, type WalletRow } from "@/lib/wallet.functions";
import { PageHeader } from "@/components/page-header";
import { NextActionBlock } from "@/components/next-action-block";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Briefcase, Search, ArrowRight, TrendingUp, AlertTriangle, Clock, Flame, Receipt, Download,
  Megaphone, Workflow, X, Sparkles,
} from "lucide-react";

import { toCSV, downloadCSV } from "@/lib/csv-export";

export const Route = createFileRoute("/_app/carteira")({
  component: CarteiraPage,
});

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Bucket = "todos" | "visitar" | "reativar" | "risco" | "sem_contato" | "inadimplente";

const BUCKET_LABEL: Record<Bucket, string> = {
  todos: "Toda a carteira",
  visitar: "Visitar hoje",
  reativar: "Reativar",
  risco: "Em risco",
  sem_contato: "Sem contato 30d+",
  inadimplente: "Inadimplentes",
};

function statusBadge(s: WalletRow["status"]) {
  if (s === "ativo") return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20">ativo</Badge>;
  if (s === "atencao") return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20">atenção</Badge>;
  if (s === "risco") return <Badge variant="destructive">risco</Badge>;
  if (s === "novo") return <Badge variant="secondary">novo</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">inativo</Badge>;
}

function scorePill(score: number) {
  const tone =
    score >= 70 ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
    : score >= 40 ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
    : "bg-destructive/15 text-destructive border-destructive/30";
  return <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${tone}`}>{score}</span>;
}

function CarteiraPage() {
  const { orgId } = useCurrentOrg();
  const run = useServerFn(getCommercialWallet);
  const [bucket, setBucket] = useState<Bucket>("todos");
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState<string>("all");
  const [repFilter, setRepFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const clearSelection = () => setSelected(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["wallet", orgId],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId! } }),
    refetchOnWindowFocus: false,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (bucket !== "todos" && !r.buckets.includes(bucket as any)) return false;
      if (industry !== "all" && r.industry !== industry) return false;
      if (repFilter !== "all" && r.representative_id !== repFilter) return false;
      if (stateFilter !== "all" && r.state !== stateFilter) return false;
      if (term && !r.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [data, bucket, q, industry, repFilter, stateFilter]);

  const uniqueReps = useMemo(() => {
    if (!data) return [];
    const reps = new Map();
    data.rows.forEach(r => {
      if (r.representative_id) reps.set(r.representative_id, r.representative_name);
    });
    return Array.from(reps.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const uniqueStates = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.rows.map(r => r.state).filter(Boolean))).sort() as string[];
  }, [data]);


  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Carteira comercial"
        subtitle="Quem comprou, quem está sumindo, quem está pronto pra recomprar — em uma visão só."
        icon={Briefcase}
      />

      <div className="mt-4"><NextActionBlock surface="carteira" /></div>



      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPI loading={isLoading} label="Clientes" value={data?.summary.total ?? 0} icon={Briefcase} />
        <KPI loading={isLoading} label="Ativos" value={data?.summary.active ?? 0} icon={TrendingUp} tone="ok" />
        <KPI loading={isLoading} label="Atenção" value={data?.summary.attention ?? 0} icon={Clock} tone="warn" />
        <KPI loading={isLoading} label="Risco" value={data?.summary.risk ?? 0} icon={AlertTriangle} tone="danger" />
        <KPI loading={isLoading} label="A receber em atraso" value={data ? fmt(data.summary.totalOverdue) : "—"} icon={Receipt} tone="danger" />
      </div>

      <Card className="p-3 space-y-3">
        <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
          <TabsList className="flex flex-wrap h-auto">
            {(Object.keys(BUCKET_LABEL) as Bucket[]).map((b) => (
              <TabsTrigger key={b} value={b} className="gap-2">
                {BUCKET_LABEL[b]}
                {data && (
                  <span className="text-[10px] text-muted-foreground">
                    {b === "todos"
                      ? data.rows.length
                      : data.rows.filter((r) => r.buckets.includes(b as any)).length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por cliente, cidade..."
              className="pl-8"
            />
          </div>
          <Select value={industry} onValueChange={setIndustry}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="Segmento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os segmentos</SelectItem>
              {(data?.industries ?? []).map((i) => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={repFilter} onValueChange={setRepFilter}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="Representante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Representantes</SelectItem>
              {uniqueReps.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-full md:w-32">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Estados</SelectItem>
              {uniqueStates.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            className="gap-2 shrink-0"
            disabled={filtered.length === 0}
            onClick={() => {
              const csv = toCSV(
                filtered.map((r) => ({
                  cliente: r.name,
                  segmento: r.industry ?? "",
                  status: r.status,
                  score: r.score,
                  faturado: r.wonRevenue,
                  ticket_medio: r.ticketAvg,
                  pipeline_aberto: r.openPipeline,
                  dias_sem_compra: r.daysSinceLastPurchase ?? "",
                  frequencia_12m: r.frequency,
                  atividades_30d: r.activitiesLast30,
                  em_atraso: r.overdueAmount,
                  buckets: r.buckets.join("|"),
                })),
                [
                  { key: "cliente", label: "Cliente" },
                  { key: "segmento", label: "Segmento" },
                  { key: "status", label: "Status" },
                  { key: "score", label: "Score" },
                  { key: "faturado", label: "Faturado" },
                  { key: "ticket_medio", label: "Ticket médio" },
                  { key: "pipeline_aberto", label: "Pipeline aberto" },
                  { key: "dias_sem_compra", label: "Dias sem compra" },
                  { key: "frequencia_12m", label: "Frequência 12m" },
                  { key: "atividades_30d", label: "Atividades 30d" },
                  { key: "em_atraso", label: "Em atraso" },
                  { key: "buckets", label: "Lentes" },
                ],
              );
              downloadCSV(`carteira-${bucket}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
            }}
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </Card>

      {/* Barra de ações em lote — aparece quando há clientes selecionados */}
      {selected.size > 0 && (
        <Card className="p-3 flex flex-wrap items-center gap-2 border-primary/40 bg-primary/5">
          <span className="text-sm font-medium pr-2">
            {selected.size} cliente{selected.size === 1 ? "" : "s"} selecionado{selected.size === 1 ? "" : "s"}
          </span>
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <Link
              to="/campaigns"
              search={{ companies: Array.from(selected).join(",") } as any}
            >
              <Megaphone className="h-3.5 w-3.5" /> Criar campanha
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <Link
              to="/sequences"
              search={{ companies: Array.from(selected).join(",") } as any}
            >
              <Workflow className="h-3.5 w-3.5" /> Inscrever em sequência
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              const sel = filtered.filter((r) => selected.has(r.company_id));
              const csv = toCSV(
                sel.map((r) => ({
                  cliente: r.name,
                  segmento: r.industry ?? "",
                  status: r.status,
                  score: r.score,
                  faturado: r.wonRevenue,
                  pipeline_aberto: r.openPipeline,
                  buckets: r.buckets.join("|"),
                })),
                [
                  { key: "cliente", label: "Cliente" },
                  { key: "segmento", label: "Segmento" },
                  { key: "status", label: "Status" },
                  { key: "score", label: "Score" },
                  { key: "faturado", label: "Faturado" },
                  { key: "pipeline_aberto", label: "Pipeline aberto" },
                  { key: "buckets", label: "Lentes" },
                ],
              );
              downloadCSV(`carteira-selecionados-${new Date().toISOString().slice(0, 10)}.csv`, csv);
            }}
          >
            <Download className="h-3.5 w-3.5" /> Exportar selecionados
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto gap-1.5" onClick={clearSelection}>
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        </Card>
      )}



      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhum cliente nessa lente. Tente outro filtro ou aba.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <Checkbox
                      checked={
                        filtered.length > 0 &&
                        filtered.slice(0, 200).every((r) => selected.has(r.company_id))
                      }
                      onCheckedChange={(v) => {
                        const ids = filtered.slice(0, 200).map((r) => r.company_id);
                        setSelected((s) => {
                          const n = new Set(s);
                          if (v) ids.forEach((id) => n.add(id));
                          else ids.forEach((id) => n.delete(id));
                          return n;
                        });
                      }}
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="text-left px-3 py-2">Cliente / Local</th>
                  <th className="text-left px-3 py-2 hidden lg:table-cell">Responsável</th>
                  <th className="text-right px-3 py-2">Score</th>
                  <th className="text-right px-3 py-2 hidden md:table-cell">Potencial</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2 hidden md:table-cell">Faturado</th>
                  <th className="text-right px-3 py-2 hidden lg:table-cell">Pipeline</th>
                  <th className="text-right px-3 py-2 hidden md:table-cell">Última compra</th>
                  <th className="text-left px-3 py-2 hidden xl:table-cell font-bold text-primary">Próxima Ação IA</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((r) => (
                  <tr key={r.company_id} className="border-t hover:bg-accent/30 group">
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={selected.has(r.company_id)}
                        onCheckedChange={() => toggle(r.company_id)}
                        aria-label={`Selecionar ${r.name}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium truncate max-w-[240px] group-hover:text-primary transition-colors">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-tight">
                        {r.city ? `${r.city} - ${r.state || ""}` : (r.industry || "—")}
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      <div className="text-xs truncate max-w-[120px]">{r.representative_name || "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{scorePill(r.score)}</td>
                    <td className="px-3 py-2 text-right hidden md:table-cell">
                      <div className="text-xs font-bold text-muted-foreground">{r.potential}%</div>
                    </td>
                    <td className="px-3 py-2">{statusBadge(r.status)}</td>
                    <td className="px-3 py-2 text-right font-mono hidden md:table-cell">{fmt(r.wonRevenue)}</td>
                    <td className="px-3 py-2 text-right font-mono hidden lg:table-cell">{fmt(r.openPipeline)}</td>
                    <td className="px-3 py-2 text-right hidden md:table-cell">
                      {r.daysSinceLastPurchase === null
                        ? <span className="text-muted-foreground">—</span>
                        : <span className={r.daysSinceLastPurchase > 90 ? "text-amber-600" : ""}>{r.daysSinceLastPurchase}d</span>}
                    </td>
                    <td className="px-3 py-2 hidden xl:table-cell">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/5 px-2 py-1 rounded-full border border-primary/10 w-fit">
                        <Sparkles className="h-3 w-3" /> {r.nextAiAction}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild size="sm" variant="ghost" className="gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link to="/companies/$id" params={{ id: r.company_id }}>
                          Abrir <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>
          {filtered.length > 200 && (
            <div className="px-3 py-2 text-xs text-muted-foreground border-t">
              Mostrando 200 de {filtered.length}. Refine os filtros.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function KPI({
  label, value, icon: Icon, tone, loading,
}: {
  label: string; value: string | number; icon: typeof Briefcase;
  tone?: "ok" | "warn" | "danger"; loading?: boolean;
}) {
  const color =
    tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-amber-600"
    : tone === "ok" ? "text-emerald-600"
    : "text-primary";
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      {loading ? <Skeleton className="h-6 w-16 mt-1" /> : <div className={`text-xl font-semibold mt-1 ${color}`}>{value}</div>}
    </Card>
  );
}
