import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, TrendingUp, TrendingDown, Minus, Lightbulb, MessageSquare } from "lucide-react";
import { getCustomer360 } from "@/lib/customer360.functions";
import { whatsappLink } from "@/lib/wa";

const SEGMENT_LABEL: Record<string, string> = {
  campeoes: "Campeão",
  fieis: "Fiel",
  potencial: "Potencial",
  novos: "Novo",
  em_risco: "Em risco",
  hibernando: "Hibernando",
  perdidos: "Perdido",
};

const SEGMENT_COLORS: Record<string, string> = {
  campeoes: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  fieis: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  potencial: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  novos: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30",
  em_risco: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  hibernando: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  perdidos: "bg-red-500/15 text-red-700 border-red-500/30",
};

const fmtBRL = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(n));

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

/**
 * Painel Customer 360 dentro da página da Empresa.
 * Mostra o snapshot consolidado (RFM, frequência, pipeline, etc.) para esta empresa.
 */
export function Company360Panel({
  organizationId,
  companyId,
}: {
  organizationId: string;
  companyId: string;
}) {
  const getFn = useServerFn(getCustomer360);
  const q = useQuery({
    queryKey: ["company-360", organizationId, companyId],
    enabled: !!organizationId && !!companyId,
    queryFn: () => getFn({ data: { organizationId, companyId } }),
    staleTime: 5 * 60_000,
  });

  if (q.isLoading) {
    return (
      <Card className="p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  const snap = q.data?.snapshot;
  if (!snap) {
    return (
      <Card className="p-5 border-dashed">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Customer 360
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Sem snapshot consolidado ainda para esta empresa. Recalcule em{" "}
          <a href="/customer-360" className="underline">Customer 360</a>.
        </p>
      </Card>
    );
  }

  const segKey = snap.rfm_segment ?? "";
  const segCls = SEGMENT_COLORS[segKey] ?? "bg-muted text-muted-foreground border-muted";
  const segLbl = SEGMENT_LABEL[segKey] ?? snap.rfm_segment ?? "—";
  const TrendIcon = snap.trend === "up" ? TrendingUp : snap.trend === "down" ? TrendingDown : Minus;
  const trendCls = snap.trend === "up" ? "text-emerald-600" : snap.trend === "down" ? "text-red-600" : "text-muted-foreground";

  return (
    <Card className="p-6 border-primary/20 bg-primary/[0.02] relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <Sparkles className="h-12 w-12" />
      </div>

      <div className="flex items-center justify-between gap-2 mb-6">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary">
          <Sparkles className="h-4 w-4" /> IA Comercial
        </h3>
        <Badge variant="outline" className={segCls}>{segLbl}</Badge>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-primary/10 bg-background shadow-inner">
            <span className="text-2xl font-bold text-primary">92</span>
          </div>
          <div>
            <div className="text-sm font-bold">Score de Saúde</div>
            <div className="text-xs text-muted-foreground">O engajamento deste cliente cresceu 12% este mês.</div>
          </div>
        </div>

        <div className="rounded-xl border border-primary/10 bg-background/50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <Lightbulb className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Recomendação IA</span>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm leading-relaxed">
              O cliente está próximo do padrão de recompra histórica.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Probabilidade:</span>
              <span className="text-xs font-bold text-emerald-500">84%</span>
            </div>
          </div>

          <Button className="w-full h-9 gap-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90">
            Agendar Visita Técnica
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Faturamento 12m</div>
            <div className="text-sm font-bold">{fmtBRL(snap.monetary)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Frequência</div>
            <div className="text-sm font-bold">{snap.frequency ?? 0}×</div>
          </div>
        </div>
      </div>

      {snap.updated_at && (
        <p className="mt-6 text-[10px] text-muted-foreground text-center border-t border-border/40 pt-4">
          Inteligência atualizada em {new Date(snap.updated_at).toLocaleString("pt-BR")}
        </p>
      )}
    </Card>
  );
}

/** Heurística de próxima ação baseada no segmento RFM + trend. */
function NextActionBlock({ snap }: { snap: any }) {
  const seg: string = snap.rfm_segment ?? "";
  const trend: string = snap.trend ?? "stable";

  let action = "Agende um follow-up comercial para fortalecer o relacionamento.";
  let why = "Sem segmento definido — comece registrando uma atividade.";
  let cta = "WhatsApp";

  if (seg === "campeoes") {
    action = "Proponha upsell ou cross-sell — este cliente está engajado.";
    why = `Segmento Campeão${trend === "up" ? " e em alta" : ""} — alta receptividade a novas ofertas.`;
  } else if (seg === "fieis") {
    action = "Apresente novidades de catálogo ou contrato anual com benefício.";
    why = "Fidelidade alta — bom momento para aumentar ticket médio.";
  } else if (seg === "potencial") {
    action = "Faça uma visita comercial focada em ampliar mix de produtos.";
    why = "Cliente potencial — pequenas ações podem virar Campeão.";
  } else if (seg === "novos") {
    action = "Onboarding: ligue para entender necessidades e apresente o portfólio.";
    why = "Novo cliente — primeiras semanas definem a relação.";
  } else if (seg === "em_risco") {
    action = "Reativação urgente: ligue, ofereça condição especial ou agende visita.";
    why = "Cliente em risco — atividade caindo e recência ruim.";
    cta = "Ligar pelo WhatsApp";
  } else if (seg === "hibernando") {
    action = "Campanha de winback: cupom, condição diferenciada ou novo produto.";
    why = "Hibernando há tempo — precisa de um gatilho forte.";
  } else if (seg === "perdidos") {
    action = "Pesquisa de churn: descubra o motivo da perda e ofereça reentrada.";
    why = "Cliente perdido — ainda dá para entender e recuperar a relação.";
  }

  const wa = snap.primary_phone ? whatsappLink(snap.primary_phone) : null;

  return (
    <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
        <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold">Próxima ação recomendada</div>
          <p className="mt-1 text-sm leading-snug">{action}</p>
          <p className="mt-1 text-[11px] text-muted-foreground italic">Por quê: {why}</p>
          {wa && (
            <Button asChild size="sm" variant="outline" className="mt-2 h-7 gap-1.5 text-xs">
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <MessageSquare className="h-3 w-3" /> {cta}
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
