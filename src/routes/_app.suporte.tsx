import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Headphones, MessageSquare, Clock, CheckCircle2, AlertCircle, Plus, Mail, ShieldAlert, BarChart3, Users, Zap, Search, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectorAssistant } from "@/components/sector-assistant";
import { ErpSyncHealth } from "@/components/erp-sync-health";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/suporte")({ component: SupportPage });

function SupportPage() {
  const tickets = [
    { id: "TK-102", subject: "Erro na integração Bling", customer: "Móveis Estrela", status: "Aberto", priority: "Crítica", time: "2h", avatar: "ME" },
    { id: "TK-105", subject: "Dúvida sobre relatórios", customer: "Tech Solutions", status: "Em Atendimento", priority: "Média", time: "15m", avatar: "TS" },
    { id: "TK-108", subject: "Solicitação de novo campo", customer: "Indústria Alfa", status: "Aguardando", priority: "Baixa", time: "1d", avatar: "IA" },
  ];

  return (
    <div className="space-y-8 p-4 md:p-8">
      <PageHeader
        title="Centro de Suporte & Sucesso"
        subtitle="Gerencie tickets, monitore SLAs e garanta o sucesso imediato do cliente com IA."
        icon={Headphones}
        action={<Button className="font-bold gap-2"><Plus className="h-4 w-4" />Novo Ticket</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <SectorAssistant 
            sector="Suporte"
            recommendations={[
              {
                title: "Prioridade Crítica Detectada",
                description: "O ticket TK-102 de 'Móveis Estrela' refere-se a erro de integração (Bling). O SLA vence em 30min.",
                icon: ShieldAlert
              },
              {
                title: "Base de Conhecimento Sugerida",
                description: "Detectamos 3 tickets similares sobre 'Relatórios'. Deseja criar um artigo na base de conhecimento?",
                icon: Zap
              }
            ]}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Tickets Abertos" value="12" icon={AlertCircle} color="text-rose-500" />
            <StatCard label="TMR (Médio)" value="18min" icon={Clock} color="text-blue-500" />
            <StatCard label="SLA de Hoje" value="98.5%" icon={CheckCircle2} color="text-emerald-500" />
          </div>

          <Card className="overflow-hidden border-border/40 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-muted/20 border-b border-border/40">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Fila de Atendimento
              </CardTitle>
              <div className="relative w-64 hidden sm:block">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar ticket ou cliente..." className="pl-8 h-9 text-xs" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40">
                {tickets.map((t) => (
                  <div key={t.id} className="p-5 flex items-center justify-between hover:bg-muted/10 transition-colors group cursor-pointer">
                    <div className="flex gap-4 items-center">
                      <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center font-bold text-xs text-primary border border-primary/10">
                        {t.avatar}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-sm group-hover:text-primary transition-colors">{t.subject}</span>
                          <Badge variant="outline" className="text-[9px] uppercase font-mono py-0">{t.id}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/70">{t.customer}</span>
                          <span className="flex items-center gap-1">• {t.time} atrás</span>
                          <span className={cn(
                            "flex items-center gap-1 font-bold uppercase text-[9px]",
                            t.priority === "Crítica" ? "text-rose-500" : "text-amber-500"
                          )}>
                            {t.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={cn(
                        "text-[10px] uppercase tracking-tighter",
                        t.status === "Aberto" ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      )}>
                        {t.status}
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Mail className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <ErpSyncHealth />

          <Card className="border-border/40 overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <LifeBuoy className="h-4 w-4 text-primary" /> Recursos Úteis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <ResourceItem title="Base de Conhecimento" count="128 artigos" icon={Search} />
              <ResourceItem title="Documentação Técnica" count="42 docs" icon={BarChart3} />
              <ResourceItem title="Vídeos de Treinamento" count="15 vídeos" icon={Users} />
              <Button className="w-full mt-2 font-bold text-xs uppercase tracking-widest" variant="outline">
                Portal de Ajuda
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ResourceItem({ title, count, icon: Icon }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/50 hover:border-primary/20 transition-all cursor-pointer group">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        <div>
          <div className="text-xs font-bold">{title}</div>
          <div className="text-[10px] text-muted-foreground uppercase">{count}</div>
        </div>
      </div>
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
