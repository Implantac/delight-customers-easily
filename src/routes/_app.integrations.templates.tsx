import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { RequireManager } from "@/components/require-manager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { listMappingTemplates, applyMappingTemplate } from "@/lib/erp-templates.functions";

export const Route = createFileRoute("/_app/integrations/templates")({
  component: TemplatesPage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">Erro: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Não encontrado</div>,
});

function TemplatesPage() {
  const { organization } = useCurrentOrg();
  const orgId = organization?.id;
  const router = useRouter();
  const listFn = useServerFn(listMappingTemplates);
  const applyFn = useServerFn(applyMappingTemplate);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["erp-mapping-templates"],
    queryFn: () => listFn({ data: undefined as never }),
  });

  async function apply(key: "omie" | "tiny" | "protheus") {
    if (!orgId) return;
    setBusy(key);
    try {
      const r = await applyFn({ data: { organization_id: orgId, template: key, overwrite } });
      toast.success(`${r.applied} mapeamentos aplicados`);
      router.invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <RequireManager>
      <div className="p-6 space-y-6">
        <PageHeader title="Templates de Mapeamento" description="Aplique mapeamentos prontos para ERPs conhecidos. Apenas dados comerciais." />

        <div className="flex items-center gap-2">
          <Checkbox id="ow" checked={overwrite} onCheckedChange={(v) => setOverwrite(Boolean(v))} />
          <Label htmlFor="ow" className="cursor-pointer">Substituir mapeamentos existentes do provider</Label>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {data?.templates.map((t) => (
              <Card key={t.key}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {t.label}
                    <Badge variant="secondary">{t.count} campos</Badge>
                  </CardTitle>
                  <CardDescription>Entidades: {t.entities.join(", ")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" disabled={!orgId || busy === t.key} onClick={() => apply(t.key as "omie" | "tiny" | "protheus")}>
                    {busy === t.key ? "Aplicando…" : "Aplicar template"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RequireManager>
  );
}
