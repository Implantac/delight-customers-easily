import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, RefreshCcw, Database, Cloud } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function ErpSyncHealth() {
  const syncs = [
    { name: "Clientes", status: "success", lastSync: "há 5 min", items: 4201, health: 100 },
    { name: "Pedidos", status: "success", lastSync: "há 2 min", items: 12450, health: 99.8 },
    { name: "Produtos", status: "warning", lastSync: "há 1h", items: 850, health: 85 },
    { name: "Financeiro", status: "success", lastSync: "há 10 min", items: 310, health: 100 },
  ];

  return (
    <Card className="p-6 border-border/40 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <RefreshCcw className="h-4 w-4 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Saúde da Integração ERP</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Sincronização em tempo real</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-emerald-500/5 text-emerald-500 border-emerald-500/20 gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Conectado
        </Badge>
      </div>

      <div className="space-y-4">
        {syncs.map((sync) => (
          <div key={sync.name} className="p-3 rounded-lg border border-border/40 bg-background/50 group hover:border-primary/30 transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {sync.status === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <span className="text-sm font-medium">{sync.name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{sync.lastSync}</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Progress value={sync.health} className="h-1" />
              </div>
              <span className="text-[10px] font-mono">{sync.health}%</span>
            </div>
            
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Database className="h-3 w-3" />
                  {sync.items} docs
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Cloud className="h-3 w-3" />
                  Nuvem OK
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
