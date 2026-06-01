import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { runErpSmokeTest, type SmokeReport } from "@/lib/erp-smoke-test.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, PlayCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/integrations/smoke-test")({
  component: SmokeTestPage,
});

function SmokeTestPage() {
  const run = useServerFn(runErpSmokeTest);
  const m = useMutation<SmokeReport>({ mutationFn: () => run({ data: {} }) });

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Smoke Test — ERP Connect</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Valida fluxo end-to-end sem credenciais reais: criptografia, registry de drivers,
          capacidade de push CRM→ERP e acesso à fila outbox.
        </p>
      </div>

      <Button onClick={() => m.mutate()} disabled={m.isPending} size="lg">
        {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
        Executar verificação
      </Button>

      {m.error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">
            Erro: {(m.error as Error).message}
          </CardContent>
        </Card>
      )}

      {m.data && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Resultado</CardTitle>
              <Badge variant={m.data.ok ? "default" : "destructive"}>
                {m.data.ok ? "TODOS OK" : "FALHAS"}
              </Badge>
            </div>
            <CardDescription>Executado em {new Date(m.data.ran_at).toLocaleString()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {m.data.checks.map((c, i) => (
              <div key={i} className="flex gap-3 rounded-md border p-3">
                {c.ok ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                )}
                <div className="space-y-1">
                  <div className="font-medium text-sm">{c.name}</div>
                  <div className="text-xs text-muted-foreground break-words">{c.detail}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
