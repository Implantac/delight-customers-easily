import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Users, MapPin, Rocket, ArrowRight, BrainCircuit, Target, Zap, MessageSquare, Headphones, Heart, LayoutDashboard, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

import { Link } from "@tanstack/react-router";

export function MuralComercial() {
  const { user } = useAuth();

  const metrics = [
    { 
      label: "Oportunidades", 
      value: "R$ 482.000", 
      description: "Valor total em aberto",
      icon: TrendingUp, 
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      to: "/pipeline"
    },
    { 
      label: "Atenção Necessária", 
      value: "17", 
      description: "Clientes precisam de retorno",
      icon: Users, 
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      to: "/carteira"
    },
    { 
      label: "Alto Potencial", 
      value: "3 Regiões", 
      description: "Oportunidades geolocalizadas",
      icon: Target, 
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      to: "/geo"
    },
    { 
      label: "Visitas Sugeridas", 
      value: "12 Prospects", 
      description: "Prontos para visitar hoje",
      icon: MapPin, 
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      to: "/geo-rota"
    },
  ];

  const insights = [
    { name: "Ciclo de Venda", status: "Reduzido em 12%", progress: 88, icon: Zap, color: "text-amber-500" },
    { name: "Conversão Lead/Ouv", status: "+5% este mês", progress: 65, icon: Target, color: "text-blue-500" },
    { name: "Retenção de Oport.", status: "Estável", progress: 94, icon: ShieldCheck, color: "text-emerald-500" },
  ];

  return (
    <div className="space-y-10">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-4 items-center">
             <div className="bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-sm shadow-primary/5">
                <div className="relative">
                  <TrendingUp className="h-5 w-5" />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" 
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Volume em Aberto</span>
                  <span className="text-xl font-display font-bold tabular-nums leading-none mt-0.5">R$ 482.000</span>
                </div>
             </div>

             <div className="bg-rose-500/5 text-rose-500 border border-rose-500/20 px-4 py-2 rounded-2xl flex items-center gap-3">
                <Users className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Atenção Crítica</span>
                  <span className="text-xl font-display font-bold tabular-nums leading-none mt-0.5">17 Clientes</span>
                </div>
             </div>

             <div className="bg-blue-500/5 text-blue-500 border border-blue-500/20 px-4 py-2 rounded-2xl flex items-center gap-3">
                <Target className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Regiões Quentes</span>
                  <span className="text-xl font-display font-bold tabular-nums leading-none mt-0.5">3 Áreas</span>
                </div>
             </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
          >
            <Link to={m.to as any}>
              <Card className="relative overflow-hidden p-6 border-border/40 bg-card/40 backdrop-blur-xl hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all group border-l-4 h-full" style={{ borderLeftColor: `var(--${m.color.split('-')[1]}-500)` }}>
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
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 p-8 rounded-3xl bg-card border border-border/50 relative overflow-hidden group shadow-xl shadow-black/5"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest border border-primary/20">
              <Sparkles className="h-3 w-3" /> Copiloto Comercial Ativo
            </div>
            
            <h3 className="text-3xl font-display font-semibold max-w-xl leading-tight">
              Pronto para maximizar sua performance comercial hoje?
            </h3>
            
            <p className="text-muted-foreground text-sm max-w-md">
              A IA analisou seus leads, rotas e oportunidades. Gere o plano de ação otimizado e foque no que realmente traz receita.
            </p>
            
            <div className="flex flex-wrap gap-4 pt-2">
              <Button asChild size="lg" className="rounded-xl px-8 bg-primary hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20">
                <Link to="/nba">
                  Gerar Plano de Ação <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl px-8 font-semibold">
                <Link to="/geo-rota">
                  <Zap className="mr-2 h-4 w-4 text-amber-500" /> Otimizar Rotas
                </Link>
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
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" /> Inteligência em tempo real
            </h4>
          </div>
          
          {insights.map((s, i) => (
            <Card key={s.name} className="border-border/40 bg-card/50 backdrop-blur-sm hover:border-primary/20 transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-secondary", s.color)}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground font-medium">{s.status}</div>
                  </div>
                  <div className="text-xs font-bold">{s.progress}%</div>
                </div>
                <Progress value={s.progress} className="h-1.5 mt-3" />
              </CardContent>
            </Card>
          ))}
        </motion.div>
      </div>
    </div>
  );
}


