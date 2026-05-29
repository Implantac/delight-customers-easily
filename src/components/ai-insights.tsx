import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { aiAssist } from "@/lib/ai.functions";

type Action = "summarize_contact" | "score_deal" | "next_action";
type Props = { contactId?: string; dealId?: string; actions: Action[] };

const LABELS: Record<Action, string> = {
  summarize_contact: "Resumir contato",
  next_action: "Sugerir próxima ação",
  score_deal: "Avaliar probabilidade",
};

export function AIInsights({ contactId, dealId, actions }: Props) {
  const call = useServerFn(aiAssist);
  const [output, setOutput] = useState<string>("");
  const [active, setActive] = useState<Action | null>(null);

  const m = useMutation({
    mutationFn: async (action: Action) => {
      setActive(action);
      setOutput("");
      const r = await call({ data: { action, contact_id: contactId, deal_id: dealId } });
      return r.result;
    },
    onSuccess: (text) => setOutput(text),
    onError: (e: any) => { toast.error(e.message ?? "Falha na IA"); setActive(null); },
    onSettled: () => setActive(null),
  });

  return (
    <Card className="p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-primary" /> Insights de IA
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a} size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate(a)}>
            {m.isPending && active === a ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            {LABELS[a]}
          </Button>
        ))}
      </div>
      {output && (
        <div className="mt-4 whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
          {output}
        </div>
      )}
    </Card>
  );
}
