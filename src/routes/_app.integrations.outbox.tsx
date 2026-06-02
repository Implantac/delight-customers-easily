import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { RequireManager } from "@/components/require-manager";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { listOutbox, resolveOutbox, resolveOutboxBulk } from "@/lib/erp-outbox.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Inbox, Eye, Search, RefreshCw, Zap, X, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/integrations/outbox")({
  component: OutboxPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-destructive">Erro: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Não encontrado</div>,
});

const STATUS = [
  "pending",
  "running",
  "needs_manual",
  "failed",
  "succeeded",
  "cancelled",
] as const;
type Status = (typeof STATUS)[number];

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pendentes",
  running: "Rodando",
  needs_manual: "Revisar",
  failed: "Falhas",
  succeeded: "Concluídos",
  cancelled: "Cancelados",
};

function statusVariant(
  s: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (s === "succeeded") return "default";
  if (s === "failed" || s === "needs_manual") return "destructive";
  if (s === "running") return "secondary";
  return "outline";
}

type OutboxItem = {
  id: string;
  integration_id: string;
  entity: string;
  action: string;
  external_id: string | null;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  scheduled_at: string;
  created_at: string;
  payload?: unknown;
};

function OutboxPage() {
  const { orgId } = useCurrentOrg();
  const router = useRouter();
  const listFn = useServerFn(listOutbox);
  const resolveFn = useServerFn(resolveOutbox);
  const bulkFn = useServerFn(resolveOutboxBulk);
  const [tab, setTab] = useState<Status>("needs_manual");
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<OutboxItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Contagem por status (busca em paralelo, com limit alto)
  const countsBig = useQueries({
    queries: STATUS.map((s) => ({
      queryKey: ["erp-outbox-count-big", orgId, s],
      queryFn: async () => {
        const r = await listFn({
          data: { organization_id: orgId!, status: s, limit: 100 },
        });
        return r.items.length;
      },
      enabled: !!orgId,
      refetchInterval: 30_000,
    })),
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["erp-outbox", orgId, tab],
    queryFn: () =>
      listFn({ data: { organization_id: orgId!, status: tab, limit: 100 } }),
    enabled: !!orgId,
    refetchInterval: 15_000,
  });

  async function act(
    id: string,
    strategy: "retry" | "cancel" | "mark_succeeded",
  ) {
    setBusy(id);
    try {
      await resolveFn({ data: { id, strategy } });
      toast.success(
        strategy === "retry"
          ? "Reenfileirado"
          : strategy === "cancel"
            ? "Cancelado"
            : "Marcado como concluído",
      );
      await refetch();
      router.invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function bulk(strategy: "retry" | "cancel" | "mark_succeeded") {
    if (!selected.size) return;
    setBulkBusy(true);
    try {
      const r = await bulkFn({ data: { ids: Array.from(selected), strategy } });
      toast.success(
        `${r.count} ${
          strategy === "retry" ? "reenfileirados" : strategy === "cancel" ? "cancelados" : "marcados como concluído"
        }`,
      );
      setSelected(new Set());
      await refetch();
      router.invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }

  const items = (data?.items ?? []) as OutboxItem[];
  const filtered = search
    ? items.filter((it) => {
        const q = search.toLowerCase();
        return (
          it.entity.toLowerCase().includes(q) ||
          it.action.toLowerCase().includes(q) ||
          (it.external_id ?? "").toLowerCase().includes(q) ||
          (it.last_error ?? "").toLowerCase().includes(q)
        );
      })
    : items;

  const allSelected = filtered.length > 0 && filtered.every((it) => selected.has(it.id));
  const someSelected = selected.size > 0 && !allSelected;
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((it) => it.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  // Limpa seleção ao trocar de aba
  useEffect(() => {
    setSelected(new Set());
  }, [tab]);

  return (
    <RequireManager>
      <div className="p-6 space-y-6">
        <PageHeader
          icon={Inbox}
          title="Fila CRM → ERP"
          subtitle="Mutações comerciais aguardando propagação ao ERP. Itens em 'Revisar' requerem ação manual."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          }
        />

        {/* Contagem por status */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {STATUS.map((s, idx) => {
            const c = countsBig[idx]?.data ?? 0;
            const active = tab === s;
            const tone =
              s === "failed" || s === "needs_manual"
                ? "text-destructive"
                : s === "succeeded"
                  ? "text-emerald-600"
                  : s === "running"
                    ? "text-primary"
                    : "text-muted-foreground";
            return (
              <button
                key={s}
                onClick={() => setTab(s)}
                className={`rounded-md border p-3 text-left transition hover:bg-accent ${
                  active ? "border-primary ring-1 ring-primary/30" : ""
                }`}
              >
                <div className={`text-2xl font-semibold leading-none ${tone}`}>
                  {c}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                  {STATUS_LABEL[s]}
                </div>
              </button>
            );
          })}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              {STATUS.map((s) => (
                <TabsTrigger key={s} value={s}>
                  {STATUS_LABEL[s]}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar entidade, ID, erro..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          <TabsContent value={tab} className="mt-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {STATUS_LABEL[tab]} · {filtered.length}
                  {search && items.length !== filtered.length && (
                    <span className="text-xs text-muted-foreground ml-2">
                      de {items.length}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Barra de ação em massa */}
                {selected.size > 0 && (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                    <div className="text-sm font-medium">
                      {selected.size} selecionado{selected.size > 1 ? "s" : ""}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={bulkBusy}
                        onClick={() => bulk("retry")}
                        className="gap-1.5"
                      >
                        <Zap className="h-3.5 w-3.5" /> Retentar em massa
                      </Button>
                      {(tab === "needs_manual" || tab === "failed") && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={bulkBusy}
                          onClick={() => bulk("mark_succeeded")}
                          className="gap-1.5"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Marcar concluído
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={bulkBusy}
                        onClick={() => bulk("cancel")}
                        className="gap-1.5"
                      >
                        <X className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={bulkBusy}
                        onClick={() => setSelected(new Set())}
                      >
                        Limpar
                      </Button>
                    </div>
                  </div>
                )}
                {isLoading ? (
                  <p className="text-muted-foreground">Carregando…</p>
                ) : !filtered.length ? (
                  <p className="text-muted-foreground text-sm">
                    {search ? "Nenhum item bate com a busca." : "Nenhum item neste status."}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <Checkbox
                            checked={allSelected ? true : someSelected ? "indeterminate" : false}
                            onCheckedChange={toggleAll}
                            aria-label="Selecionar todos"
                          />
                        </TableHead>
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
                      {filtered.map((it) => (
                        <TableRow key={it.id} data-state={selected.has(it.id) ? "selected" : undefined}>
                          <TableCell>
                            <Checkbox
                              checked={selected.has(it.id)}
                              onCheckedChange={() => toggleOne(it.id)}
                              aria-label="Selecionar"
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{it.entity}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(it.status)}>
                              {it.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {it.external_id ?? "—"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                it.attempts >= it.max_attempts
                                  ? "text-destructive font-medium"
                                  : ""
                              }
                            >
                              {it.attempts}/{it.max_attempts}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                            {it.last_error ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(it.created_at).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right space-x-1 whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDetail(it)}
                              title="Ver payload"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {(tab === "needs_manual" ||
                              tab === "failed" ||
                              tab === "cancelled") && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === it.id}
                                onClick={() => act(it.id, "retry")}
                              >
                                Retentar
                              </Button>
                            )}
                            {tab === "needs_manual" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === it.id}
                                onClick={() => act(it.id, "mark_succeeded")}
                              >
                                Concluído
                              </Button>
                            )}
                            {(tab === "pending" ||
                              tab === "needs_manual" ||
                              tab === "failed") && (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={busy === it.id}
                                onClick={() => act(it.id, "cancel")}
                              >
                                Cancelar
                              </Button>
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

        {/* Dialog de detalhe do payload */}
        <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Badge variant="outline">{detail?.entity}</Badge>
                <Badge variant={statusVariant(detail?.status ?? "")}>
                  {detail?.action}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {detail?.external_id ? (
                  <>
                    External ID:{" "}
                    <span className="font-mono">{detail.external_id}</span> ·{" "}
                  </>
                ) : null}
                Tentativas: {detail?.attempts}/{detail?.max_attempts}
              </DialogDescription>
            </DialogHeader>
            {detail && (
              <div className="space-y-3 text-sm">
                {detail.last_error && (
                  <div className="rounded border border-destructive/30 bg-destructive/5 p-3">
                    <div className="text-xs uppercase tracking-wide text-destructive mb-1">
                      Erro
                    </div>
                    <p className="text-xs whitespace-pre-wrap break-words">
                      {detail.last_error}
                    </p>
                  </div>
                )}
                <div className="rounded border p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    Payload
                  </div>
                  <pre className="text-xs whitespace-pre-wrap break-all max-h-80 overflow-auto">
                    {JSON.stringify(detail.payload ?? {}, null, 2)}
                  </pre>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {(detail.status === "needs_manual" ||
                    detail.status === "failed" ||
                    detail.status === "cancelled") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === detail.id}
                      onClick={() => {
                        act(detail.id, "retry");
                        setDetail(null);
                      }}
                    >
                      Retentar
                    </Button>
                  )}
                  {detail.status === "needs_manual" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === detail.id}
                      onClick={() => {
                        act(detail.id, "mark_succeeded");
                        setDetail(null);
                      }}
                    >
                      Marcar concluído
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RequireManager>
  );
}
