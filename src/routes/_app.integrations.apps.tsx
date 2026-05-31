import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import {
  listConnections,
  upsertConnection,
  disconnectIntegration,
  deleteConnection,
  triggerSync,
} from "@/lib/integrations-connections.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Mail, Calendar, MessageCircle, RefreshCw, Trash2, Plug, Plug2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/integrations/apps")({ component: AppsIntegrationsPage });

type Kind = "gmail" | "outlook" | "google_calendar" | "whatsapp";

const CATALOG: Array<{ kind: Kind; label: string; description: string; Icon: any }> = [
  { kind: "gmail", label: "Gmail", description: "Sincroniza emails enviados/recebidos com leads e contatos.", Icon: Mail },
  { kind: "outlook", label: "Outlook", description: "Sincroniza emails Microsoft com leads e contatos.", Icon: Mail },
  { kind: "google_calendar", label: "Google Calendar", description: "Importa eventos como reuniões/atividades.", Icon: Calendar },
  { kind: "whatsapp", label: "WhatsApp Business", description: "Mensagens viram atividades vinculadas pelo telefone.", Icon: MessageCircle },
];

function AppsIntegrationsPage() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const qc = useQueryClient();

  const listFn = useServerFn(listConnections);
  const upsertFn = useServerFn(upsertConnection);
  const disconnectFn = useServerFn(disconnectIntegration);
  const delFn = useServerFn(deleteConnection);
  const syncFn = useServerFn(triggerSync);

  const q = useQuery({
    queryKey: ["app-connections", orgId],
    queryFn: () => listFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const [openKind, setOpenKind] = useState<Kind | null>(null);
  const [label, setLabel] = useState("");

  const upsertMut = useMutation({
    mutationFn: (vars: { kind: Kind; account_label: string }) =>
      upsertFn({ data: { organization_id: orgId!, ...vars } }),
    onSuccess: () => {
      toast.success("Conexão criada");
      setOpenKind(null);
      setLabel("");
      qc.invalidateQueries({ queryKey: ["app-connections", orgId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao conectar"),
  });

  const disconnectMut = useMutation({
    mutationFn: (id: string) => disconnectFn({ data: { id } }),
    onSuccess: () => { toast.success("Desconectado"); qc.invalidateQueries({ queryKey: ["app-connections", orgId] }); },
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["app-connections", orgId] }); },
  });
  const syncMut = useMutation({
    mutationFn: (id: string) => syncFn({ data: { id } }),
    onSuccess: () => { toast.success("Sync disparado"); qc.invalidateQueries({ queryKey: ["app-connections", orgId] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao sincronizar"),
  });

  const connections = q.data?.connections ?? [];
  const lastByConn = q.data?.lastSyncByConn ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrações de Apps"
        subtitle="Conecte Email, Calendário e WhatsApp ao seu CRM. Os itens sincronizados aparecem como atividades dos contatos."
        icon={Plug}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATALOG.map((item) => {
          const conns = connections.filter((c: any) => c.kind === item.kind);
          return (
            <Card key={item.kind}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="rounded-md bg-primary/10 p-2 text-primary"><item.Icon className="h-5 w-5" /></div>
                    <div>
                      <h3 className="font-semibold">{item.label}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  {canManage && (
                    <Button size="sm" variant="outline" onClick={() => { setOpenKind(item.kind); setLabel(""); }}>
                      <Plug2 className="h-4 w-4 mr-1" /> Conectar
                    </Button>
                  )}
                </div>

                {conns.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhuma conta conectada.</p>
                ) : (
                  <div className="space-y-2">
                    {conns.map((c: any) => {
                      const last = lastByConn[c.id];
                      return (
                        <div key={c.id} className="rounded border p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{c.account_label}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                              <StatusBadge status={c.status} />
                              {c.last_sync_at ? (
                                <span>Sync: {formatDistanceToNow(new Date(c.last_sync_at), { addSuffix: true, locale: ptBR })}</span>
                              ) : (
                                <span>Nunca sincronizado</span>
                              )}
                              {last?.items_processed > 0 && <span>· {last.items_processed} itens</span>}
                            </div>
                          </div>
                          {canManage && (
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="ghost" onClick={() => syncMut.mutate(c.id)} disabled={syncMut.isPending}>
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => disconnectMut.mutate(c.id)}>
                                Desconectar
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover?")) delMut.mutate(c.id); }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground">
          As conexões são registradas aqui. Para ativar sync real, precisamos das credenciais OAuth do provedor (Google, Microsoft, Meta) — peça quando quiser habilitar.
        </CardContent>
      </Card>

      <Dialog open={!!openKind} onOpenChange={(o) => !o && setOpenKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Conectar {openKind ? CATALOG.find((c) => c.kind === openKind)?.label : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Identificador da conta</Label>
              <Input
                placeholder={openKind === "whatsapp" ? "+55 11 9..." : "email@empresa.com"}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Usado para diferenciar múltiplas contas do mesmo tipo.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenKind(null)}>Cancelar</Button>
            <Button
              onClick={() => openKind && upsertMut.mutate({ kind: openKind, account_label: label })}
              disabled={!label || upsertMut.isPending}
            >
              Conectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Ativo</Badge>;
  if (status === "error") return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30"><AlertTriangle className="h-3 w-3 mr-1" />Erro</Badge>;
  return <Badge variant="outline">Desconectado</Badge>;
}
