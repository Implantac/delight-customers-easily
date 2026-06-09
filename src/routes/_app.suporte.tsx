import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Headphones, MessageSquare, Clock, CheckCircle2, AlertCircle, Plus, Mail, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectorAssistant } from "@/components/sector-assistant";

export const Route = createFileRoute("/_app/suporte")({ component: SupportPage });

function SupportPage() {
  const tickets = [
    { id: "TK-102", subject: "Erro na integração Bling", customer: "Móveis Estrela", status: "Em Aberto", priority: "Alta", time: "2h" },
    { id: "TK-105", subject: "Dúvida sobre relatórios", customer: "Tech Solutions", status: "Em Atendimento", priority: "Média", time: "15m" },
    { id: "TK-108", subject: "Solicitação de novo campo", customer: "Indústria Alfa", status: "Aguardando", priority: "Baixa", time: "1d" },
  ];

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Suporte & Atendimento"
        subtitle="Gerencie tickets, chamados e garanta o sucesso imediato do cliente."
        icon={Headphones}
        action={<Button className="font-bold"><Plus className="mr-2 h-4 w-4" />Novo Ticket</Button>}
      />

      <SectorAssistant 
        sector="Suporte"
        recommendations={[
          {
            title: "Tickets Críticos em Atraso",
            description: "3 tickets de clientes Tier 1 estão fora do SLA de 1 hora. Recomendo priorizar atendimento agora.",
            icon: ShieldAlert
          },
          {
            title: "Resposta Automática de Follow-up",
            description: "Detectamos que 5 clientes aguardam retorno há mais de 4h. Deseja enviar e-mail de posicionamento?",
            icon: Mail
          }
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Tickets em Aberto" value="12" icon={AlertCircle} color="text-rose-500" />
        <StatCard label="Tempo Médio de Resposta" value="18min" icon={Clock} color="text-blue-500" />
        <StatCard label="SLA de hoje" value="98.5%" icon={CheckCircle2} color="text-emerald-500" />
      </div>

      <Card className="overflow-hidden border-border/40">
        <div className="p-6 border-b border-border/40 bg-muted/30">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Tickets Recentes
          </h3>
        </div>
        <div className="divide-y divide-border/40">
          {tickets.map((t) => (
            <div key={t.id} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
              <div className="flex gap-4 items-start">
                <Badge variant="outline" className="font-mono text-[10px]">{t.id}</Badge>
                <div>
                  <div className="font-medium">{t.subject}</div>
                  <div className="text-xs text-muted-foreground">{t.customer} • Priority: {t.priority}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground">{t.time}</span>
                <Badge className={t.status === "Em Aberto" ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20" : "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"}>
                  {t.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}


function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="p-6 border-border/40 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="text-3xl font-display font-bold">{value}</div>
    </Card>
  );
}
