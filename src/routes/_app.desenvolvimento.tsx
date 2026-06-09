import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Code2, Bug, Rocket, Terminal, Layers, Info, Zap, Github, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectorAssistant } from "@/components/sector-assistant";
import { ErpSyncHealth } from "@/components/erp-sync-health";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/desenvolvimento")({ component: DevPage });

function DevPage() {
  const roadmap = [
    { title: "Módulo de IA Preditiva", status: "Em Progresso", progress: 65, priority: "Crítica" },
    { title: "Refatoração de API de Integração", status: "Planejado", progress: 0, priority: "Alta" },
    { title: "App Mobile (Fase 2)", status: "Backlog", progress: 0, priority: "Média" },
  ];

  return (
    <div className="space-y-8 p-4 md:p-8">
      <PageHeader
        title="Desenvolvimento & Produto"
        subtitle="Acompanhe o ciclo de inovação, roadmaps tecnológicos e sprints de evolução do sistema."
        icon={Terminal}
        action={<Button variant="outline" className="font-bold border-primary/20 gap-2"><Bug className="h-4 w-4 text-rose-500" />Reportar Issue</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <SectorAssistant 
            sector="Desenvolvimento"
            recommendations={[
              {
                title: "Pull Requests Aguardando",
                description: "Existem 4 PRs críticos para a v3.2.1 que ainda não foram revisados. Priorizar hoje?",
                icon: Code2
              },
              {
                title: "Novo Driver de Integração",
                description: "Sugestão: Desenvolver driver nativo para Protheus v12 para reduzir latência em 40%.",
                icon: Zap
              }
            ]}
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Sprint Atual" value="v3.2.1" icon={GitBranch} color="text-blue-500" />
            <StatCard label="PRs Abertos" value="14" icon={Code2} color="text-violet-500" />
            <StatCard label="Issues" value="2" icon={Bug} color="text-rose-500" />
            <StatCard label="Velocity" value="8.4" icon={Rocket} color="text-emerald-500" />
          </div>

          <Card className="border-border/40 overflow-hidden shadow-sm">
            <CardHeader className="bg-muted/20 border-b border-border/40">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> Roadmap de Produto
              </CardTitle>
            </CardHeader>
            <div className="divide-y divide-border/40">
              {roadmap.map((item) => (
                <div key={item.title} className="p-5 hover:bg-muted/10 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-bold text-sm group-hover:text-primary transition-colors">{item.title}</div>
                    <div className="flex gap-2 items-center">
                      <Badge variant="outline" className="text-[9px] uppercase tracking-widest font-bold border-primary/10">{item.status}</Badge>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Prioridade: {item.priority}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold">{item.progress}%</div>
                      <div className="w-32 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <ErpSyncHealth />

          <Card className="p-6 border-border/40 bg-card/50">
            <h3 className="font-bold text-sm mb-6 flex items-center gap-2">
              <Github className="h-4 w-4" /> Repositórios Ativos
            </h3>
            <div className="space-y-4">
              <RepoItem name="use-crm-core" branch="main" status="healthy" />
              <RepoItem name="erp-hub-service" branch="v2-stable" status="healthy" />
              <RepoItem name="ai-engine-worker" branch="experiment/gpt5" status="warning" />
            </div>
            <Button className="w-full mt-6 font-bold" variant="outline">
              Abrir Painel DevOps
            </Button>
          </Card>

          <Card className="p-6 border-primary/20 bg-primary/5">
             <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                <Boxes className="h-4 w-4 text-primary" /> Módulos Instalados
             </h3>
             <p className="text-[10px] text-muted-foreground uppercase mb-4 tracking-widest font-bold">Ecossistema consolidado</p>
             <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-[9px]">Salesforce Sync</Badge>
                <Badge variant="secondary" className="text-[9px]">WhatsApp Gateway</Badge>
                <Badge variant="secondary" className="text-[9px]">AI Copilot v3</Badge>
                <Badge variant="secondary" className="text-[9px]">GeoRouting Service</Badge>
             </div>
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

function RepoItem({ name, branch, status }: any) {
  return (
    <div className="flex items-center justify-between group cursor-pointer">
      <div>
        <div className="text-xs font-bold group-hover:text-primary transition-colors">{name}</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <GitBranch className="h-3 w-3" /> {branch}
        </div>
      </div>
      <div className={cn(
        "h-2 w-2 rounded-full",
        status === "healthy" ? "bg-emerald-500" : "bg-amber-500"
      )} />
    </div>
  );
}
