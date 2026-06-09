import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MessageSquare, Bell, Clock, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings/alerts")({ component: SmartAlertsPage });

function SmartAlertsPage() {
  const [alerts, setAlerts] = useState({
    rep_morning: true,
    manager_daily: true,
    churn_risk: true,
    lead_hot: true
  });

  const [time, setTime] = useState("07:30");

  const handleSave = () => {
    toast.success("Configurações de Alertas Inteligentes salvas!");
  };

  return (
    <div className="page-container max-w-3xl space-y-8">
      <PageHeader
        icon={Bell}
        title="Alertas Inteligentes"
        subtitle="Configure o envio automático de inteligência comercial via WhatsApp e notificações."
      />

      <Card className="border-primary/10 bg-gradient-to-br from-background to-primary/5">
        <CardHeader>
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
             </div>
             <div>
                <CardTitle>Horário de Envio</CardTitle>
                <CardDescription>Defina quando o Copilot enviará o resumo do dia para sua equipe.</CardDescription>
             </div>
          </div>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Input 
            type="time" 
            value={time} 
            onChange={e => setTime(e.target.value)} 
            className="w-32 h-12 text-lg font-bold text-center"
          />
          <div className="text-sm text-muted-foreground italic">
            Recomendado: Início do expediente para representantes externos.
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Zap className="h-4 w-4" /> Gatilhos de Inteligência
        </h3>

        <AlertToggle 
          title="Resumo da Rota (Representante)" 
          desc="Envia a rota sugerida, clientes prioritários e follow-ups pendentes no início do dia."
          checked={alerts.rep_morning}
          onChange={(v: boolean) => setAlerts({...alerts, rep_morning: v})}
        />

        <AlertToggle 
          title="Performance Diária (Gestor)" 
          desc="Resumo consolidado de oportunidades ganhas, perdidas e atingimento de meta do grupo."
          checked={alerts.manager_daily}
          onChange={(v: boolean) => setAlerts({...alerts, manager_daily: v})}
        />

        <AlertToggle 
          title="Alerta de Churn (Urgente)" 
          desc="Notificação imediata quando a IA detecta risco alto de perda de um cliente Tier 1."
          checked={alerts.churn_risk}
          onChange={(v: boolean) => setAlerts({...alerts, churn_risk: v})}
        />

        <AlertToggle 
          title="Leads Quentes (Imediato)" 
          desc="Avisa o vendedor responsável assim que um lead com score > 80 interage nos canais."
          checked={alerts.lead_hot}
          onChange={(v: boolean) => setAlerts({...alerts, lead_hot: v})}
        />

      </div>

      <div className="pt-6 border-t border-border/40 flex justify-end gap-3">
        <Button variant="ghost">Restaurar Padrões</Button>
        <Button onClick={handleSave} className="px-8 font-bold rounded-full">
            <Sparkles className="mr-2 h-4 w-4" /> Salvar Configurações
        </Button>
      </div>
    </div>
  );
}

function AlertToggle({ title, desc, checked, onChange }: any) {
  return (
    <Card className="p-5 border-border/40 hover:border-primary/20 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-bold">{title}</div>
          <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </Card>
  );
}
