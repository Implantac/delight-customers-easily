import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Check, Circle, Sparkles } from "lucide-react";
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
        supabase.from("integrations").select("id", { count: "exact", head: true }),
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
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Comece por aqui</h3>
        <span className="ml-auto text-xs text-muted-foreground">{completed} de {steps.length}</span>
      </div>
      <ul className="mt-3 space-y-2">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              to={s.to}
              className={cn(
                "flex items-center gap-2 rounded-md border p-2.5 text-sm transition hover:bg-accent",
                s.done && "opacity-60",
              )}
            >
              {s.done
                ? <Check className="h-4 w-4 text-success" />
                : <Circle className="h-4 w-4 text-muted-foreground" />}
              <span className={cn(s.done && "line-through")}>{s.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
