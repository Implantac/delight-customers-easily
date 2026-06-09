import { motion } from "framer-motion";
import { BrainCircuit, CheckCircle2, Clock, Sparkles, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SectorAssistantProps {
  sector: string;
  recommendations: {
    title: string;
    description: string;
    icon: any;
  }[];
}

export function SectorAssistant({ sector, recommendations }: SectorAssistantProps) {
  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background relative group">
      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
        <BrainCircuit className="h-24 w-24 text-primary" />
      </div>

      <div className="p-6 relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Assistente de {sector}</h3>
            <p className="text-[10px] text-muted-foreground">Sugestões baseadas em rotinas e prazos de entrega</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map((rec, i) => (
            <motion.div
              key={rec.title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-4 rounded-xl border border-border/40 bg-card/40 hover:border-primary/30 transition-all flex gap-4"
            >
              <div className="p-2 rounded-full bg-secondary h-fit">
                <rec.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-bold">{rec.title}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
                <Button variant="link" size="sm" className="h-auto p-0 text-[11px] font-bold text-primary">
                  Executar agora
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-border/40 flex items-center justify-between">
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Meta de Retorno: 1h</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Eficiência: 92%</span>
            </div>
          </div>
          <Button size="sm" className="rounded-full gap-2">
            <MessageSquare className="h-3.5 w-3.5" /> Falar com Copilot
          </Button>
        </div>
      </div>
    </Card>
  );
}
