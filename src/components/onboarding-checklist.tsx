import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Check, Circle, Sparkles, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Step = { key: string; label: string; to: string; done: boolean };

export function OnboardingChecklist() {
  const { data } = useQuery({
    queryKey: ["onboarding-counts"],
    queryFn: async () => {
      const [c, e, d, a, w, i] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("deals").select("id", { count: "exact", head: true }),
        supabase.from("activities").select("id", { count: "exact", head: true }),
        supabase.from("whatsapp_conversations").select("id", { count: "exact", head: true }),
        supabase.from("erp_integrations").select("id", { count: "exact", head: true }),
      ]);
      return {
        contacts: c.count ?? 0,
        companies: e.count ?? 0,
        deals: d.count ?? 0,
        activities: a.count ?? 0,
        whatsapp: w.count ?? 0,
        integrations: i.count ?? 0,
      };
    },
    staleTime: 30_000,
  });

  if (!data) return null;

  const steps: Step[] = [
    { key: "company", label: "Cadastrar 1ª empresa", to: "/companies", done: data.companies > 0 },
    { key: "contact", label: "Adicionar 1º contato", to: "/contacts", done: data.contacts > 0 },
    { key: "deal", label: "Criar 1º negócio no pipeline", to: "/pipeline", done: data.deals > 0 },
    { key: "activity", label: "Registrar 1ª atividade", to: "/activities", done: data.activities > 0 },
    { key: "whatsapp", label: "Abrir 1ª conversa no WhatsApp", to: "/whatsapp", done: data.whatsapp > 0 },
    { key: "integration", label: "Conectar ERP em Integrações", to: "/integrations", done: data.integrations > 0 },
  ];

  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) return null;

  return (
    <Card className="p-8 rounded-[2.5rem] shadow-xl shadow-black/5 border-border/40 bg-card/40 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg leading-none">Comece por aqui</h3>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1 opacity-70">Onboarding do Time</p>
          </div>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-0.5 text-xs bg-primary/20 text-primary border-primary/20 font-bold">
          {completed}/{steps.length}
        </Badge>
      </div>
      <ul className="space-y-3">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              to={s.to}
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-border/40 p-4 text-sm font-medium transition-all duration-300",
                s.done ? "opacity-50 bg-secondary/30 grayscale-[0.5]" : "bg-card hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 shadow-sm shadow-black/[0.02]",
              )}
            >
              <div className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center border transition-colors",
                s.done ? "bg-success/10 border-success/30 text-success" : "bg-muted/50 border-border/60 text-muted-foreground",
              )}>
                {s.done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
              </div>
              <span className={cn("flex-1", s.done && "line-through text-muted-foreground")}>{s.label}</span>
              {!s.done && <ArrowRight className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
