import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { RequireManager } from "@/components/require-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listOutbox, resolveOutbox } from "@/lib/erp-outbox.functions";

export const Route = createFileRoute("/_app/integrations/outbox")({
  component: OutboxPage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">Erro: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Não encontrado</div>,
});

const STATUS = ["pending", "running", "needs_manual", "failed", "succeeded", "cancelled"] as const;
type Status = (typeof STATUS)[number];

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "succeeded") return "default";
  if (s === "failed" || s === "needs_manual") return "destructive";
  if (s === "running") return "secondary";
  return "outline";
}

function OutboxPage() {
  const { organization } = useCurrentOrg();
  const orgId = organization?.id;
  const router = useRouter();
  const listFn = useServerFn(listOutbox);
  const resolveFn = useServerFn(resolveOutbox);
  const [tab, setTab] = useState<Status>("needs_manual");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["erp-outbox", orgId, tab],
    queryFn: () => listFn({ data: { organization_id: orgId!, status: tab, limit: 100 } }),
    enabled: !!orgId,
  });

  async function act(id: string, strategy: "retry" | "cancel" | "mark_succeeded") {
    setBusy(id);
    try {
      await resolveFn({ data: { id, strategy } });
      toast.success("Item atualizado");
      await refetch();
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
        <PageHeader
          title="Fila CRM → ERP"
          description="Mutações comerciais aguardando propagação ao ERP. Itens em 'needs_manual' requerem revisão."
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
          <TabsList>
            {STATUS.map((s) => (
              <TabsTrigger key={s} value={s}>{s}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={tab}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{tab.toUpperCase()}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Carregando…</p>
                ) : !data?.items.length ? (
                  <p className="text-muted-foreground text-sm">Nenhum item neste status.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entidade</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>External ID</TableHead>
                        <TableHead>Tentativas</TableHead>
                        <TableHead>Erro</TableHead>
                        <TableHead>Criado</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell><Badge variant="outline">{it.entity}</Badge></TableCell>
                          <TableCell><Badge variant={statusVariant(it.status)}>{it.action}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{it.external_id ?? "—"}</TableCell>
                          <TableCell>{it.attempts}/{it.max_attempts}</TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{it.last_error ?? "—"}</TableCell>
                          <TableCell className="text-xs">{new Date(it.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-right space-x-1">
                            {(tab === "needs_manual" || tab === "failed" || tab === "cancelled") && (
                              <Button size="sm" variant="outline" disabled={busy === it.id} onClick={() => act(it.id, "retry")}>Retentar</Button>
                            )}
                            {tab === "needs_manual" && (
                              <Button size="sm" variant="outline" disabled={busy === it.id} onClick={() => act(it.id, "mark_succeeded")}>Concluído</Button>
                            )}
                            {(tab === "pending" || tab === "needs_manual" || tab === "failed") && (
                              <Button size="sm" variant="destructive" disabled={busy === it.id} onClick={() => act(it.id, "cancel")}>Cancelar</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RequireManager>
  );
}
