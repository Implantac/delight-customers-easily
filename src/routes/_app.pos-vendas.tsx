import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Users, TrendingDown, Target, Zap, ArrowUpRight, Smile, Briefcase, Star, Search, Filter, Mail, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SectorAssistant } from "@/components/sector-assistant";
import { ErpSyncHealth } from "@/components/erp-sync-health";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/pos-vendas")({ component: PosVendasPage });

function PosVendasPage() {
  const clients = [
    { name: "Móveis Estrela", health: 85, stage: "Upsell", owner: "Maria Silva", mrr: "R$ 4.200", lastTouch: "2 dias" },
    { name: "Tech Solutions", health: 42, stage: "Risco de Churn", owner: "João Santos", mrr: "R$ 1.500", lastTouch: "15 dias" },
    { name: "Indústria Alfa", health: 98, stage: "Promotor", owner: "Maria Silva", mrr: "R$ 8.900", lastTouch: "Hoje" },
  ];

  return (
    <div className="space-y-8 p-4 md:p-8">
      <PageHeader
        title="Gestão de Sucesso do Cliente"
        subtitle="Monitore a saúde da base, reduza churn e turbine expansões com inteligência comercial."
        icon={Heart}
        action={<Button variant="outline" className="font-bold border-primary/20 gap-2"><Zap className="h-4 w-4 text-amber-500" />Ver Previsão de Churn</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <SectorAssistant 
            sector="Pós-Vendas"
            recommendations={[
              {
                title: "Feedback de NPS Pendente",
                description: "3 clientes promotores (score > 90) ainda não foram convidados para deixar depoimento no G2/Capterra.",
                icon: Star
              },
              {
                title: "Oportunidade de Expansão",
                description: "'Móveis Estrela' aumentou o uso de API em 300% esta semana. Sugerimos oferta de plano Enterprise.",
                icon: TrendingDown
              }
            ]}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Saúde da Base" value="78%" icon={Heart} color="text-rose-500" />
            <StatCard label="Expansão Mês" value="R$ 42.0k" icon={ArrowUpRight} color="text-emerald-500" />
            <StatCard label="NRR" value="102.4%" icon={Target} color="text-blue-500" />
          </div>

          <Card className="border-border/40 overflow-hidden shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-muted/20 border-b border-border/40">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Clientes sob Gestão
              </CardTitle>
              <div className="flex gap-2">
                 <Button variant="outline" size="sm" className="h-8 text-[10px] uppercase tracking-widest font-bold"><Filter className="h-3 w-3 mr-1" /> Filtrar</Button>
                 <Button variant="outline" size="sm" className="h-8 text-[10px] uppercase tracking-widest font-bold"><Search className="h-3 w-3 mr-1" /> Buscar</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40">
                {clients.map((c) => (
                  <div key={c.name} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/10 transition-colors group">
                    <div className="flex gap-4 items-center">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-bold text-[10px] border",
                        c.health > 80 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                        c.health > 50 ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : 
                        "bg-rose-500/10 text-rose-500 border-rose-500/20"
                      )}>
                        <span className="text-lg">{c.health}</span>
                        <span className="opacity-70 uppercase tracking-tighter">Score</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-sm group-hover:text-primary transition-colors">{c.name}</span>
                          <Badge variant="secondary" className="text-[9px] uppercase tracking-tighter">{c.stage}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium"><Users className="h-3 w-3" /> {c.owner}</span>
                          <span className="flex items-center gap-1">• MRR: <span className="text-foreground/80">{c.mrr}</span></span>
                          <span className="flex items-center gap-1">• Último contato: {c.lastTouch}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end md:self-auto">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CalendarDays className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest border-primary/20 text-primary">Abrir 360°</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <ErpSyncHealth />


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-6 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Clientes Críticos (Atenção)
          </h3>
          <div className="space-y-6">
            {clients.map((c) => (
              <div key={c.name} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant={c.health < 50 ? "destructive" : "secondary"}>{c.stage}</Badge>
                </div>
                <div className="flex items-center gap-4">
                  <Progress value={c.health} className="h-2" />
                  <span className="text-xs font-mono w-10">{c.health}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 bg-primary/5 border-primary/20">
          <h3 className="font-semibold mb-4">Próximas Renovações</h3>
          <p className="text-sm text-muted-foreground mb-6">Contratos com vencimento nos próximos 30 dias.</p>
          <div className="space-y-4">
            <RenewalItem name="Global Logistics" date="Em 12 dias" value="R$ 15.000" />
            <RenewalItem name="BioCare Lab" date="Em 18 dias" value="R$ 8.500" />
            <RenewalItem name="Nova Tech" date="Em 25 dias" value="R$ 12.200" />
          </div>
        </Card>
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

function RenewalItem({ name, date, value }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/40">
      <div>
        <div className="text-sm font-semibold">{name}</div>
        <div className="text-[10px] text-muted-foreground uppercase">{date}</div>
      </div>
      <div className="text-sm font-bold text-primary">{value}</div>
    </div>
  );
}
