import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import {
  listConflicts,
  resolveConflict,
} from "@/lib/erp-conflicts.functions";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/integrations/conflicts")({
  component: ConflictsPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-destructive">Erro: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Não encontrado</div>,
});

type Resolution = "use_crm" | "use_erp" | "merge" | "ignore";

function ConflictsPage() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const qc = useQueryClient();
  const [onlyOpen, setOnlyOpen] = useState(true);

  const fetchList = useServerFn(listConflicts);
  const resolveFn = useServerFn(resolveConflict);

  const list = useQuery({
    queryKey: ["erp-conflicts", orgId, onlyOpen],
    queryFn: () =>
      fetchList({
        data: { organization_id: orgId!, only_open: onlyOpen, limit: 100 },
      }),
    enabled: !!orgId,
  });

  const mut = useMutation({
    mutationFn: (vars: { id: string; resolution: Resolution }) =>
      resolveFn({ data: vars }),
    onSuccess: () => {
      toast.success("Conflito resolvido");
      qc.invalidateQueries({ queryKey: ["erp-conflicts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Conflitos de sincronização"
        subtitle="Resolva divergências entre CRM e ERP detectadas pelo motor de sync."
        icon={AlertTriangle}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/integrations">Voltar</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Lista</CardTitle>
            <CardDescription>
              Comercial apenas — nunca dados fiscais ou financeiros.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="open"
              checked={onlyOpen}
              onCheckedChange={setOnlyOpen}
            />
            <Label htmlFor="open">Somente abertos</Label>
          </div>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p>Nenhum conflito {onlyOpen ? "aberto" : "registrado"}.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recurso</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead>Campo</TableHead>
                  <TableHead>CRM</TableHead>
                  <TableHead>ERP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => {
                  const resolved = !!c.resolved_at;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.resource}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.external_id}
                      </TableCell>
                      <TableCell>{c.field ?? "—"}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs">
                        {JSON.stringify(c.crm_value)}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs">
                        {JSON.stringify(c.erp_value)}
                      </TableCell>
                      <TableCell>
                        {resolved ? (
                          <Badge variant="secondary">{c.resolution}</Badge>
                        ) : (
                          <Badge variant="destructive">aberto</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!resolved && canManage ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={mut.isPending}
                              onClick={() =>
                                mut.mutate({
                                  id: c.id,
                                  resolution: "use_crm",
                                })
                              }
                            >
                              Manter CRM
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={mut.isPending}
                              onClick={() =>
                                mut.mutate({
                                  id: c.id,
                                  resolution: "use_erp",
                                })
                              }
                            >
                              Aceitar ERP
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={mut.isPending}
                              onClick={() =>
                                mut.mutate({
                                  id: c.id,
                                  resolution: "ignore",
                                })
                              }
                            >
                              Ignorar
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {resolved ? "resolvido" : "somente leitura"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
