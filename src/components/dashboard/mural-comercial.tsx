import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Users, MapPin, Rocket, ArrowRight, BrainCircuit, Target, Zap, MessageSquare, Headphones, Heart, LayoutDashboard, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export function MuralComercial() {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Comercial";

  const metrics = [
    { 
      label: "Oportunidades", 
      value: "R$ 482.000", 
      description: "Valor total em aberto",
      icon: TrendingUp, 
      color: "text-emerald-500",
      bg: "bg-emerald-500/10"
    },
    { 
      label: "Atenção Necessária", 
      value: "17", 
      description: "Clientes precisam de retorno",
      icon: Users, 
      color: "text-rose-500",
      bg: "bg-rose-500/10"
    },
    { 
      label: "Alto Potencial", 
      value: "3 Regiões", 
      description: "Oportunidades geolocalizadas",
      icon: Target, 
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    { 
      label: "Visitas Sugeridas", 
      value: "12 Prospects", 
      description: "Na rota de João hoje",
      icon: MapPin, 
      color: "text-violet-500",
      bg: "bg-violet-500/10"
    },
  ];

  const sectors = [
    { name: "Implantação", status: "Em dia", progress: 92, icon: Rocket, color: "text-violet-500" },
    { name: "Suporte", status: "3 tickets críticos", progress: 75, icon: Headphones, color: "text-rose-500" },
    { name: "Pós-Venda", status: "Saúde 8.5/10", progress: 85, icon: Heart, color: "text-emerald-500" },
  ];

  return (
    <div className="space-y-8">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <div className="absolute -left-4 top-0 h-full w-1 bg-gradient-to-b from-primary to-transparent rounded-full opacity-50" />
        <h2 className="text-4xl font-display font-bold tracking-tight mb-2 flex items-center gap-3">
          Bom dia, {firstName} <span className="text-2xl animate-pulse">✨</span>
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
          Sua equipe possui um pipeline robusto. Identificamos pontos de ação imediatos para acelerar o fechamento.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
          >
            <Card className="relative overflow-hidden p-6 border-border/40 bg-card/40 backdrop-blur-xl hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all group border-l-4" style={{ borderLeftColor: `var(--${m.color.split('-')[1]}-500)` }}>
              <div className="flex flex-col gap-4">
                <div className={cn("p-3 w-fit rounded-xl transition-colors", m.bg, m.color)}>
                  <m.icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-3xl font-display font-bold tracking-tight">{m.value}</div>
                  <div className="text-sm font-semibold text-foreground/80 mt-1">{m.label}</div>
                  <div className="text-[12px] text-muted-foreground mt-1 font-medium">{m.description}</div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 p-8 rounded-3xl bg-gradient-to-br from-primary/10 via-background to-background border border-primary/20 relative overflow-hidden group shadow-xl shadow-primary/5"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <BrainCircuit className="h-32 w-32 text-primary" />
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
              <Sparkles className="h-3 w-3" /> Copiloto Comercial Ativo
            </div>
            
            <h3 className="text-3xl font-display font-bold max-w-xl leading-tight">
              Deseja gerar um plano de ação inteligente para converter as 12 visitas em oportunidades reais hoje?
            </h3>
            
            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="rounded-full px-8 bg-primary hover:scale-105 transition-transform font-bold group shadow-lg shadow-primary/20">
                Gerar Plano de Ação <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8 border-primary/20 hover:bg-primary/5 font-semibold">
                <Zap className="mr-2 h-5 w-5 text-amber-500" /> Otimizar Rotas
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between px-2">
            <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" /> Snapshot Setores
            </h4>
            <Button variant="link" size="sm" className="text-xs text-primary font-bold">Ver Tudo</Button>
          </div>
          
          {sectors.map((s, i) => (
            <Card key={s.name} className="border-border/40 bg-card/30 backdrop-blur-sm group hover:border-primary/20 transition-all overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg bg-secondary", s.color)}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground font-medium">{s.status}</div>
                    </div>
                  </div>
                  {s.progress === 100 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : s.progress < 80 ? (
                    <AlertCircle className="h-4 w-4 text-rose-500" />
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-muted-foreground">Eficiência</span>
                    <span>{s.progress}%</span>
                  </div>
                  <Progress value={s.progress} className="h-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      </div>
    </div>
  );
}


