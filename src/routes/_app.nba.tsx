import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Phone, MessageSquare, Mail, MapPin, Gift, Eye, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import { listNbaQueue, createNbaTask, type NbaItem } from "@/lib/nba-queue.functions";

export const Route = createFileRoute("/_app/nba")({ component: NbaPage });

const ACTION_META: Record<NbaItem["action"], { label: string; icon: React.ElementType; cls: string }> = {
  visit: { label: "Visitar", icon: MapPin, cls: "bg-red-500/10 text-red-600 border-red-200" },
  call: { label: "Ligar", icon: Phone, cls: "bg-blue-500/10 text-blue-600 border-blue-200" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, cls: "bg-green-500/10 text-green-600 border-green-200" },
  email: { label: "E-mail", icon: Mail, cls: "bg-amber-500/10 text-amber-600 border-amber-200" },
  offer: { label: "Oferta", icon: Gift, cls: "bg-violet-500/10 text-violet-600 border-violet-200" },
  monitor: { label: "Monitorar", icon: Eye, cls: "bg-muted text-muted-foreground" },
};

const PRIORITY_CLS: Record<NbaItem["priority"], string> = {
  high: "bg-red-500/10 text-red-600 border-red-200",
  medium: "bg-amber-500/10 text-amber-600 border-amber-200",
  low: "bg-muted text-muted-foreground",
};

const SEGMENTS = [
  { value: "all", label: "Todos os segmentos" },
  { value: "champions", label: "Champions" },
  { value: "loyal", label: "Loyal" },
  { value: "potential_loyalists", label: "Potential loyalists" },
  { value: "new_customers", label: "New customers" },
  { value: "at_risk", label: "At risk" },
  { value: "cant_lose", label: "Can't lose" },
  { value: "hibernating", label: "Hibernating" },
  { value: "lost", label: "Lost" },
];

function NbaPage() {
  const { orgId } = useCurrentOrg();
  const navigate = useNavigate();
  const callList = useServerFn(listNbaQueue);
  const callCreate = useServerFn(createNbaTask);
  const [segment, setSegment] = useState("all");
  const [priority, setPriority] = useState<string>("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["nba-queue", orgId, segment],
    enabled: !!orgId,
    queryFn: () =>
      callList({
        data: {
          organization_id: orgId!,
          segment: segment === "all" ? undefined : segment,
          limit: 80,
        },
      }),
  });

  const items = useMemo(() => {
    const list = q.data?.items ?? [];
    return list.filter((i) => {
      if (priority !== "all" && i.priority !== priority) return false;
      if (search && !i.display_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [q.data, priority, search]);

  const grouped = useMemo(() => {
    const high = items.filter((i) => i.priority === "high");
    const medium = items.filter((i) => i.priority === "medium");
    const low = items.filter((i) => i.priority === "low");
    return { high, medium, low };
  }, [items]);

  const handled = useMutation({
    mutationFn: (i: NbaItem) =>
      callCreate({
        data: {
          organization_id: orgId!,
          title: `${ACTION_META[i.action].label} ${i.display_name} — ${i.reason}`,
          type: i.action === "visit" ? "meeting" : i.action === "call" ? "call" : "task",
        },
      }),
    onSuccess: () => {
      toast.success("Ação confirmada e integrada à sua agenda comercial");
      navigate({ to: "/meu-dia" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar tarefa"),
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        icon={Sparkles}
        title="Plano de Ação (IA)"
        subtitle={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
      />

      <Card className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <Input placeholder="Buscar cliente…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SEGMENTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard label="Alta prioridade" count={grouped.high.length} cls="text-red-600" />
        <SummaryCard label="Média" count={grouped.medium.length} cls="text-amber-600" />
        <SummaryCard label="Baixa / monitorar" count={grouped.low.length} cls="text-muted-foreground" />
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center space-y-4 border-dashed bg-muted/20">
          <Sparkles className="h-12 w-12 mx-auto text-primary/40 animate-pulse" />
          <div className="max-w-md mx-auto space-y-2">
            <p className="font-bold text-lg">Sua inteligência artificial está processando dados...</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              O USE PATRIUM analisa continuamente o comportamento dos clientes e o histórico do ERP para gerar seu plano de ação.
              Certifique-se de que o ConnectHub está sincronizado.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/integrations">Ver ConnectHub</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((i) => {
            const meta = ACTION_META[i.action];
            const Icon = meta.icon;
            return (
              <Card key={i.erp_customer_id} className="p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg border ${meta.cls}`}>
                    {Icon && <Icon className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold truncate">{i.display_name}</h3>
                      <Badge variant="outline" className={PRIORITY_CLS[i.priority]}>
                        {i.priority === "high" ? "Alta" : i.priority === "medium" ? "Média" : "Baixa"}
                      </Badge>
                      <Badge variant="outline" className={meta.cls}>
                        {meta.label}
                      </Badge>
                      {i.rfm_segment && <Badge variant="secondary" className="text-[10px]">{i.rfm_segment}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{i.reason}</p>
                    <p className="text-sm font-medium flex items-center gap-1">
                      <ArrowRight className="h-3.5 w-3.5 text-primary" /> {i.cta}
                    </p>
                    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground pt-1">
                      {i.churn_probability != null && (
                        <span>Churn: {(i.churn_probability * 100).toFixed(0)}%</span>
                      )}
                      {i.expected_value != null && Number(i.expected_value) > 0 && (
                        <span>Recompra: R$ {Math.round(Number(i.expected_value)).toLocaleString("pt-BR")}</span>
                      )}
                      {i.recency_days != null && <span>Última compra: {i.recency_days}d</span>}
                      {i.monetary != null && (
                        <span>LTV: R$ {Math.round(Number(i.monetary)).toLocaleString("pt-BR")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" onClick={() => handled.mutate(i)} disabled={handled.isPending} className="bg-primary hover:shadow-glow transition-all">
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Executar ação
                    </Button>
                    {i.company_id && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/companies/$id" params={{ id: i.company_id }}>Abrir</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, count, cls }: { label: string; count: number; cls: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-3xl font-bold ${cls}`}>{count}</p>
    </Card>
  );
}
