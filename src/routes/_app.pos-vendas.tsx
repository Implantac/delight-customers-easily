import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Heart, Users, TrendingDown, Target, Zap, ArrowUpRight, Smile, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SectorAssistant } from "@/components/sector-assistant";

export const Route = createFileRoute("/_app/pos-vendas")({ component: PosVendasPage });

function PosVendasPage() {
  const clients = [
    { name: "Móveis Estrela", health: 85, stage: "Upsell", owner: "Maria Silva" },
    { name: "Tech Solutions", health: 42, stage: "Risco de Churn", owner: "João Santos" },
    { name: "Indústria Alfa", health: 98, stage: "Advogado da Marca", owner: "Maria Silva" },
  ];

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Pós-Vendas & CS"
        subtitle="Monitore a saúde da base, reduza churn e identifique oportunidades de expansão."
        icon={Heart}
        action={<Button variant="outline" className="font-bold border-primary/20"><Zap className="mr-2 h-4 w-4 text-amber-500" />Ver Insights de Churn</Button>}
      />

      <SectorAssistant 
        sector="Pós-Vendas"
        recommendations={[
          {
            title: "Reunião de QBR Pendente",
            description: "O cliente 'Indústria Alfa' está no 3º mês de uso e ainda não teve sua reunião de resultados. Agendar?",
            icon: Briefcase
          },
          {
            title: "Potencial de Upsell Detectado",
            description: "Tech Solutions atingiu 90% do limite de armazenamento. Momento ideal para oferecer o plano Pro.",
            icon: Smile
          }
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Saúde Média da Base" value="78/100" icon={Heart} color="text-rose-500" />
        <StatCard label="Expansão (Upsell) Mês" value="R$ 42.000" icon={ArrowUpRight} color="text-emerald-500" />
        <StatCard label="Net Revenue Retention" value="102%" icon={Target} color="text-blue-500" />
      </div>


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
