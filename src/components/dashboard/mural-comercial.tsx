import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Users, MapPin, Rocket, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

export function MuralComercial() {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Comercial";

  const metrics = [
    { label: "em oportunidades", value: "R$ 184.000", icon: TrendingUp, color: "text-emerald-500" },
    { label: "clientes para recuperar", value: "17", icon: Users, color: "text-rose-500" },
    { label: "prospects na rota hoje", value: "23", icon: MapPin, color: "text-blue-500" },
    { label: "campanhas recomendadas", value: "5", icon: Rocket, color: "text-violet-500" },
  ];

  return (
    <div className="space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl font-bold tracking-tight mb-2">Bom dia, {firstName}.</h2>
        <p className="text-muted-foreground">Hoje identificamos oportunidades reais de crescimento para sua carteira.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="p-4 border-border/40 bg-card/50 backdrop-blur-sm hover:border-primary/20 transition-all group">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-secondary/50 ${m.color}`}>
                  <m.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xl font-bold">{m.value}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{m.label}</div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-9 rounded-full px-4 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all">
          Recuperar clientes
        </Button>
        <Button size="sm" variant="outline" className="h-9 rounded-full px-4 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all">
          Gerar agenda
        </Button>
        <Button size="sm" variant="outline" className="h-9 rounded-full px-4 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all">
          Criar campanha
        </Button>
        <Button size="sm" variant="outline" className="h-9 rounded-full px-4 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all">
          Abrir mapa
        </Button>
        <Button size="sm" variant="ghost" className="h-9 rounded-full px-4 text-primary font-medium hover:bg-primary/5">
          Ver oportunidades <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
