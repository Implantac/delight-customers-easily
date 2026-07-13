import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { seedKnowledgeSkills } from "@/lib/rag.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings/knowledge-base")({
  head: () => ({ meta: [{ title: "Base de Conhecimento — USE CRM" }] }),
  component: KnowledgeBasePage,
});

function KnowledgeBasePage() {
  const seed = useServerFn(seedKnowledgeSkills);
  const [result, setResult] = useState<Awaited<ReturnType<typeof seedKnowledgeSkills>> | null>(null);

  const run = useMutation({
    mutationFn: () => seed(),
    onSuccess: (r) => {
      setResult(r);
      toast.success(`${r.created} criados, ${r.updated} atualizados, ${r.skipped} sem mudança.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Base de Conhecimento (RAG)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Indexa as skills de CRM para que o Copiloto responda citando fontes.
          Rode uma vez após novas skills serem adicionadas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sincronizar skills</CardTitle>
          <CardDescription>
            Lê todas as skills empacotadas no app, gera embeddings via Lovable AI Gateway
            e grava em <code className="text-xs bg-muted px-1 rounded">knowledge_docs</code>.
            Skills já indexadas com o mesmo conteúdo são puladas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => run.mutate()} disabled={run.isPending} className="gap-2">
            <RefreshCw className={run.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {run.isPending ? "Indexando…" : "Rodar indexação"}
          </Button>

          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                <Stat label="Total" value={result.total} />
                <Stat label="Criadas" value={result.created} tone="success" />
                <Stat label="Atualizadas" value={result.updated} tone="info" />
                <Stat label="Sem mudança" value={result.skipped} tone="muted" />
              </div>

              <div className="rounded-lg border divide-y max-h-96 overflow-y-auto">
                {result.details.map((d) => (
                  <div key={d.slug} className="flex items-center gap-2 px-3 py-2 text-sm">
                    {d.error ? (
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                    <code className="text-xs flex-1">{d.slug}</code>
                    <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                    {d.error && <span className="text-xs text-destructive truncate max-w-[200px]">{d.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "info" | "muted" }) {
  const cls =
    tone === "success" ? "text-emerald-500"
      : tone === "info" ? "text-primary"
        : tone === "muted" ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
