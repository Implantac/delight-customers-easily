import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Eye, Clock, CheckCircle2, XCircle, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import {
  previewWhatsAppCampaign,
  scheduleWhatsAppCampaign,
  getWhatsAppCampaignMetrics,
} from "@/lib/whatsapp-campaign.functions";

export const Route = createFileRoute("/_app/campaigns/whatsapp")({ component: WaCampaignPage });

const SEGMENTS = [
  { value: "champions", label: "Champions" },
  { value: "loyal", label: "Loyal" },
  { value: "potential_loyalists", label: "Potential loyalists" },
  { value: "new_customers", label: "New customers" },
  { value: "at_risk", label: "At risk" },
  { value: "cant_lose", label: "Can't lose" },
  { value: "hibernating", label: "Hibernating" },
  { value: "lost", label: "Lost" },
] as const;

function WaCampaignPage() {
  const { orgId } = useCurrentOrg();
  const callPreview = useServerFn(previewWhatsAppCampaign);
  const callSchedule = useServerFn(scheduleWhatsAppCampaign);
  const callMetrics = useServerFn(getWhatsAppCampaignMetrics);

  const [segments, setSegments] = useState<string[]>([]);
  const [maxRecency, setMaxRecency] = useState<string>("");
  const [body, setBody] = useState("Olá {name}! Temos uma novidade que pode te interessar.");
  const [when, setWhen] = useState("");

  const metrics = useQuery({
    queryKey: ["wa-campaign-metrics", orgId],
    enabled: !!orgId,
    queryFn: () => callMetrics({ data: { organization_id: orgId! } }),
  });

  const preview = useMutation({
    mutationFn: () =>
      callPreview({
        data: {
          organization_id: orgId!,
          segments: segments as any,
          max_recency_days: maxRecency ? Number(maxRecency) : null,
        },
      }),
  });

  const send = useMutation({
    mutationFn: () =>
      callSchedule({
        data: {
          organization_id: orgId!,
          body,
          segments: segments as any,
          max_recency_days: maxRecency ? Number(maxRecency) : null,
          scheduled_for: when ? new Date(when).toISOString() : null,
        },
      }),
    onSuccess: (r: any) => {
      toast.success(
        `${r.queued} mensagem(ns) enfileirada(s)${r.skipped ? ` · ${r.skipped} sem telefone` : ""}`,
      );
      metrics.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao agendar"),
  });

  const toggleSeg = (s: string) =>
    setSegments((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const m = metrics.data;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        icon={MessageSquare}
        title="Campanhas WhatsApp"
        subtitle="Segmente por RFM, agende o disparo e acompanhe a entrega"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total (30d)" value={m?.total ?? 0} icon={MessageSquare} />
        <MetricCard label="Enviadas" value={m?.sent ?? 0} icon={CheckCircle2} cls="text-emerald-600" />
        <MetricCard label="Agendadas" value={m?.scheduled ?? 0} icon={Clock} cls="text-blue-600" />
        <MetricCard label="Falhas" value={m?.failed ?? 0} icon={XCircle} cls="text-red-600" />
      </div>
      {m?.successRate != null && (
        <p className="text-xs text-muted-foreground">
          Taxa de entrega: <span className="font-medium">{(m.successRate * 100).toFixed(1)}%</span>
        </p>
      )}

      <Card className="p-5 space-y-5">
        <div className="space-y-2">
          <Label>Segmentos RFM (vazio = todos os clientes com WhatsApp)</Label>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((s) => (
              <Button
                key={s.value}
                size="sm"
                type="button"
                variant={segments.includes(s.value) ? "default" : "outline"}
                onClick={() => toggleSeg(s.value)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Apenas clientes sem comprar há (dias)</Label>
            <Input
              type="number"
              placeholder="ex: 60"
              value={maxRecency}
              onChange={(e) => setMaxRecency(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Agendar para (opcional)</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Em branco = enviar agora</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Mensagem</Label>
          <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="text-[11px] text-muted-foreground">Use {"{name}"} para personalizar com o nome do cliente.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => preview.mutate()} disabled={!orgId || preview.isPending}>
            <Eye className="h-4 w-4 mr-1" />
            {preview.isPending ? "Calculando…" : "Pré-visualizar alvo"}
          </Button>
          <Button onClick={() => send.mutate()} disabled={!orgId || send.isPending || !body.trim()}>
            {when ? <Hourglass className="h-4 w-4 mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            {send.isPending ? "Enviando…" : when ? "Agendar disparo" : "Disparar agora"}
          </Button>
          {preview.data && (
            <Badge variant="secondary" className="ml-auto">
              {preview.data.total} destinatário(s)
            </Badge>
          )}
        </div>

        {preview.data && preview.data.sample.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
            <p className="font-medium">Amostra:</p>
            <ul className="space-y-0.5">
              {preview.data.sample.map((s: any, i: number) => (
                <li key={i}>
                  • {s.name} <span className="opacity-60">— {s.segment ?? "—"} · {s.recency ?? "?"}d</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

function MetricCard({
  label, value, icon: Icon, cls = "",
}: { label: string; value: number; icon: React.ElementType; cls?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${cls || "text-muted-foreground"}`} />
      </div>
      <p className={`text-2xl font-bold mt-1 ${cls}`}>{value}</p>
    </Card>
  );
}
