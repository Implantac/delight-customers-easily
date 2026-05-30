import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck, Plus, Check, X, Ban, Clock } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import { listApprovals, createApproval, decideApproval, cancelApproval } from "@/lib/approvals.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/approvals")({ component: ApprovalsPage });

const TYPE_LABEL: Record<string, string> = {
  discount: "Desconto", proposal: "Proposta", contract: "Contrato",
  refund: "Reembolso", expense: "Despesa", other: "Outro",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente", approved: "Aprovada", rejected: "Rejeitada", cancelled: "Cancelada",
};
const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline", approved: "default", rejected: "destructive", cancelled: "secondary",
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function ApprovalsPage() {
  const { orgId } = useCurrentOrg();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canManage = useCanManage();
  const fetchFn = useServerFn(listApprovals);
  const createFn = useServerFn(createApproval);
  const decideFn = useServerFn(decideApproval);
  const cancelFn = useServerFn(cancelApproval);

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected" | "cancelled">("pending");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [dialog, setDialog] = useState(false);
  const [decisionDialog, setDecisionDialog] = useState<{ id: string; decision: "approved" | "rejected" } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [draft, setDraft] = useState<any>({
    type: "discount", title: "", description: "", amount: 0, currency: "BRL",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["approvals", orgId, statusFilter, scope],
    queryFn: () => fetchFn({ data: { organization_id: orgId!, status: statusFilter, scope } }),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          organization_id: orgId!,
          type: draft.type,
          title: draft.title.trim(),
          description: draft.description?.trim() || null,
          amount: draft.amount ? Number(draft.amount) : null,
          currency: draft.currency || "BRL",
        },
      }),
    onSuccess: () => {
      toast.success("Solicitação enviada");
      setDialog(false);
      setDraft({ type: "discount", title: "", description: "", amount: 0, currency: "BRL" });
      qc.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: () =>
      decideFn({
        data: {
          id: decisionDialog!.id,
          decision: decisionDialog!.decision,
          decision_note: decisionNote.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(decisionDialog!.decision === "approved" ? "Aprovada" : "Rejeitada");
      setDecisionDialog(null);
      setDecisionNote("");
      qc.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => { toast.success("Cancelada"); qc.invalidateQueries({ queryKey: ["approvals"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const counts = data?.counts ?? { pending: 0, approved: 0, rejected: 0, cancelled: 0, total: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" /> Aprovações
          </h1>
          <p className="text-sm text-muted-foreground">Solicitações de desconto, propostas e contratos.</p>
        </div>
        <Button onClick={() => setDialog(true)}><Plus className="h-4 w-4 mr-1" /> Nova solicitação</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Pendentes</p>
          <p className="text-2xl font-bold">{counts.pending}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Check className="h-3 w-3" /> Aprovadas</p>
          <p className="text-2xl font-bold">{counts.approved}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><X className="h-3 w-3" /> Rejeitadas</p>
          <p className="text-2xl font-bold">{counts.rejected}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{counts.total}</p>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="approved">Aprovadas</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
            <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={scope} onValueChange={(v) => setScope(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todas da org</TabsTrigger>
            <TabsTrigger value="mine">Minhas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (data?.approvals ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">Nenhuma solicitação nesta categoria.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {(data?.approvals ?? []).map((a) => {
                const isMine = a.requester_id === user?.id;
                return (
                  <div key={a.id} className="p-3 hover:bg-accent/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{a.title}</p>
                          <Badge variant={STATUS_BADGE[a.status]} className="text-[10px]">{STATUS_LABEL[a.status]}</Badge>
                          <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[a.type] ?? a.type}</Badge>
                          {isMine && <Badge variant="secondary" className="text-[10px]">Minha</Badge>}
                        </div>
                        {a.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
                        )}
                        {a.decision_note && (
                          <p className="text-xs italic text-muted-foreground mt-1">"{a.decision_note}"</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Criada em {new Date(a.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="text-right">
                        {a.amount != null && (
                          <p className="font-semibold text-sm">{fmtBRL(Number(a.amount))}</p>
                        )}
                        <div className="flex gap-1 mt-2 justify-end">
                          {a.status === "pending" && canManage && (
                            <>
                              <Button size="sm" variant="default"
                                onClick={() => { setDecisionDialog({ id: a.id, decision: "approved" }); setDecisionNote(""); }}>
                                <Check className="h-4 w-4 mr-1" /> Aprovar
                              </Button>
                              <Button size="sm" variant="destructive"
                                onClick={() => { setDecisionDialog({ id: a.id, decision: "rejected" }); setDecisionNote(""); }}>
                                <X className="h-4 w-4 mr-1" /> Rejeitar
                              </Button>
                            </>
                          )}
                          {a.status === "pending" && isMine && (
                            <Button size="sm" variant="ghost" onClick={() => cancel.mutate(a.id)}>
                              <Ban className="h-4 w-4 mr-1" /> Cancelar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova solicitação de aprovação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo</Label>
                <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor (opcional)</Label>
                <Input type="number" min={0} step="0.01"
                  value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Título</Label>
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Desconto de 15% para Cliente X" />
            </div>
            <div>
              <Label>Justificativa</Label>
              <Textarea rows={4} value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Por que essa aprovação é necessária?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button disabled={!draft.title?.trim() || create.isPending} onClick={() => create.mutate()}>
              Enviar para aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!decisionDialog} onOpenChange={(o) => !o && setDecisionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionDialog?.decision === "approved" ? "Aprovar solicitação" : "Rejeitar solicitação"}
            </DialogTitle>
          </DialogHeader>
          <div>
            <Label>Observação (opcional)</Label>
            <Textarea rows={3} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionDialog(null)}>Cancelar</Button>
            <Button
              variant={decisionDialog?.decision === "approved" ? "default" : "destructive"}
              disabled={decide.isPending}
              onClick={() => decide.mutate()}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
