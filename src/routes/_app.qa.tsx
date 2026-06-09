import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, CheckSquare, ListChecks, FileWarning, Search, Microscope, FileText, CheckCircle, Bug, Activity, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectorAssistant } from "@/components/sector-assistant";
import { ErpSyncHealth } from "@/components/erp-sync-health";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/qa")({ component: QAPage });

function QAPage() {
  const tests = [
    { id: "QA-901", module: "Automação WhatsApp", type: "Integração", status: "Passou", lastRun: "10m atrás" },
    { id: "QA-905", module: "Dashboard Executivo", type: "Performance", status: "Alerta", lastRun: "1h atrás" },
    { id: "QA-908", module: "Cadastro CNPJ", type: "Funcional", status: "Falhou", lastRun: "Agora" },
  ];

  return (
    <div className="space-y-8 p-4 md:p-8">
      <PageHeader
        title="Controle de Qualidade & Q.A"
        subtitle="Monitore a integridade das implementações e garanta que cada entrega seja impecável."
        icon={ShieldCheck}
        action={<Button className="font-bold gap-2"><CheckSquare className="h-4 w-4" />Nova Inspeção</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <SectorAssistant 
            sector="Q.A"
            recommendations={[
              {
                title: "Homologação de Cliente Pendente",
                description: "O cliente 'Móveis Estrela' terminou o setup. Iniciar inspeção de qualidade de dados ERP?",
                icon: CheckCircle
              },
              {
                title: "Otimização de Performance",
                description: "Detectamos lentidão no carregamento de rotas em 12% dos usuários. Gerar relatório de debug?",
                icon: Zap
              }
            ]}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Testes Realizados" value="1.2k" icon={ListChecks} color="text-blue-500" />
            <StatCard label="Taxa de Sucesso" value="94.2%" icon={ShieldCheck} color="text-emerald-500" />
            <StatCard label="Bugs Ativos" value="18" icon={Bug} color="text-rose-500" />
          </div>

          <Card className="border-border/40 overflow-hidden shadow-sm">
            <CardHeader className="bg-muted/20 border-b border-border/40">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" /> Histórico de Inspeções
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[100px] text-[10px] uppercase font-bold tracking-widest">ID</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest">Módulo</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest">Tipo</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest">Status</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest">Última Corrida</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tests.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/10 transition-colors group cursor-pointer">
                    <TableCell className="font-mono text-xs font-bold text-primary">{t.id}</TableCell>
                    <TableCell className="font-bold text-sm">{t.module}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-tighter">{t.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          t.status === "Passou" ? "bg-emerald-500" : 
                          t.status === "Alerta" ? "bg-amber-500" : "bg-rose-500"
                        )} />
                        <span className="text-xs font-bold uppercase tracking-tight">{t.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{t.lastRun}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div className="space-y-6">
          <ErpSyncHealth />

          <Card className="p-6 border-border/40">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Staging Environment
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium">Uptime (24h)</span>
                <span className="font-bold text-emerald-500">99.98%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium">Latência Média</span>
                <span className="font-bold text-blue-500">42ms</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium">Versão Atual</span>
                <Badge variant="secondary" className="text-[9px]">v3.2.1-stable</Badge>
              </div>
            </div>
            <Button className="w-full mt-6 font-bold" variant="outline">Ver Logs de Erro</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="p-6 border-border/40 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <div className="text-2xl font-display font-bold">{value}</div>
    </Card>
  );
}
