import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { GitBranch, Code2, Bug, Rocket, Terminal, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/desenvolvimento")({ component: DevPage });

function DevPage() {
  const roadmap = [
    { title: "Módulo de IA Preditiva", status: "Em Progresso", progress: 65, priority: "Crítica" },
    { title: "Refatoração de API de Integração", status: "Planejado", progress: 0, priority: "Alta" },
    { title: "App Mobile (Fase 2)", status: "Backlog", progress: 0, priority: "Média" },
  ];

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Desenvolvimento de Produto"
        subtitle="Acompanhe o roadmap tecnológico e o progresso das novas funcionalidades solicitadas."
        icon={Terminal}
        action={<Button variant="outline"><Bug className="mr-2 h-4 w-4" />Reportar Bug Técnico</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Sprint Atual" value="v3.2.0" icon={GitBranch} color="text-blue-500" />
        <StatCard label="Pull Requests" value="14" icon={Code2} color="text-violet-500" />
        <StatCard label="Bugs Críticos" value="2" icon={Bug} color="text-rose-500" />
        <StatCard label="Deploy Velocity" value="8.4/wk" icon={Rocket} color="text-emerald-500" />
      </div>

      <Card className="p-6 border-border/40">
        <h3 className="font-semibold mb-6 flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" /> Roadmap Tecnológico
        </h3>
        <div className="space-y-4">
          {roadmap.map((item) => (
            <div key={item.title} className="p-4 rounded-xl border border-border/40 hover:border-primary/20 transition-all flex items-center justify-between group">
              <div className="space-y-1">
                <div className="font-medium group-hover:text-primary transition-colors">{item.title}</div>
                <div className="flex gap-2 items-center">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{item.status}</Badge>
                  <span className="text-xs text-muted-foreground italic">Prioridade: {item.priority}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs font-mono">{item.progress}%</div>
                  <div className="w-24 h-1 bg-muted rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
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
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="text-2xl font-display font-bold">{value}</div>
    </Card>
  );
}
