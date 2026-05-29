import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function DealHistory({ dealId }: { dealId: string }) {
  const { data: events = [] } = useQuery({
    queryKey: ["deal-events", dealId],
    queryFn: async () => (await supabase.from("deal_events").select("*").eq("deal_id", dealId).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  if (events.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><History className="h-3 w-3" />Histórico</h4>
      <ul className="space-y-1.5 text-xs">
        {events.map((e) => {
          const ago = formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: ptBR });
          let label = "";
          if (e.event_type === "created") label = `Criado · ${(e.to_value as any)?.title ?? ""}`;
          else if (e.event_type === "stage_changed") label = `Etapa: ${(e.from_value as any)?.stage} → ${(e.to_value as any)?.stage}`;
          else if (e.event_type === "value_changed") {
            const f = Number((e.from_value as any)?.value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
            const t = Number((e.to_value as any)?.value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
            label = `Valor: ${f} → ${t}`;
          } else label = e.event_type;
          return (
            <li key={e.id} className="flex justify-between gap-2 rounded border-l-2 border-muted bg-muted/30 px-2 py-1">
              <span>{label}</span>
              <span className="shrink-0 text-muted-foreground">{ago}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
