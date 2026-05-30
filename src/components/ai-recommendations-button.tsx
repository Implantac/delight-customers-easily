import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { generateAIRecommendations } from "@/lib/ai-recommendations.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export function AIRecommendationsButton() {
  const { orgId } = useCurrentOrg();
  const run = useServerFn(generateAIRecommendations);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => run({ data: { organization_id: orgId! } }),
    onSuccess: (r) => {
      toast.success(`IA gerou ${r.generated} novas recomendações`);
      qc.invalidateQueries({ queryKey: ["recommendations", orgId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha na IA"),
  });
  return (
    <Card className="p-4 flex items-center justify-between gap-4 border-primary/40 bg-primary/5">
      <div>
        <p className="text-sm font-semibold">Análise do Comitê Executivo IA (Gemini 2.5 Pro)</p>
        <p className="text-xs text-muted-foreground">Gera até 12 recomendações novas a partir dos seus dados reais.</p>
      </div>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending || !orgId}>
        <Sparkles className="h-4 w-4 mr-2" />
        {mut.isPending ? "Analisando..." : "Gerar agora"}
      </Button>
    </Card>
  );
}
