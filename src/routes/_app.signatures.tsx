import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PenLine, Plus, Send, Trash2, Pencil, X, Check, Eye, ExternalLink, Mail, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/lib/org";
import {
  listSignatureRequests, upsertSignatureRequest, sendSignatureRequest,
  updateSignerStatus, cancelSignatureRequest, deleteSignatureRequest,
} from "@/lib/signatures.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/signatures")({ component: SignaturesPage });

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", sent: "Enviado", viewed: "Visualizado",
  signed: "Assinado", declined: "Recusado", expired: "Expirado", cancelled: "Cancelado",
};
const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline", sent: "secondary", viewed: "secondary",
  signed: "default", declined: "destructive", expired: "destructive", cancelled: "outline",
};
const SIGNER_LABEL: Record<string, string> = {
  pending: "Pendente", viewed: "Visualizado", signed: "Assinou", declined: "Recusou",
};

function emptyDraft() {
  return {
    title: "",
    description: "",
    document_url: "",
    expires_at: "",
    signers: [{ name: "", email: "", role: "" }] as { name: string; email: string; role: string }[],
  };
}

function SignaturesPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const fetchFn = useServerFn(listSignatureRequests);
  const upsertFn = useServerFn(upsertSignatureRequest);
  const sendFn = useServerFn(sendSignatureRequest);
  const signerFn = useServerFn(updateSignerStatus);
  const cancelFn = useServerFn(cancelSignatureRequest);
  const delFn = useServerFn(deleteSignatureRequest);

  const [filter, setFilter] = useState<any>("all");
  const [editDlg, setEditDlg] = useState(false);
  const [draft, setDraft] = useState<any>(emptyDraft());
  const [detail, setDetail] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["signatures", orgId, filter],
    enabled: !!orgId,
    queryFn: () => fetchFn({ data: { organization_id: orgId!, status: filter } }),
  });

  const upsert = useMutation({
    mutationFn: () => upsertFn({
      data: {
        id: draft.id,
        organization_id: orgId!,
        title: draft.title.trim(),
        description: draft.description?.trim() || null,
        document_url: draft.document_url?.trim() || null,
        expires_at: draft.expires_at || null,
        signers: draft.signers
          .filter((s: any) => s.name.trim() && s.email.trim())
          .map((s: any) => ({ name: s.name.trim(), email: s.email.trim(), role: s.role?.trim() || null })),
      },
    }),
    onSuccess: () => { toast.success("Salvo"); setEditDlg(false); qc.invalidateQueries({ queryKey: ["signatures"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: (id: string) => sendFn({ data: { id } }),
    onSuccess: () => { toast.success("Enviado para signatários"); qc.invalidateQueries({ queryKey: ["signatures"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const signerMut = useMutation({
    mutationFn: (v: { signer_id: string; status: any; reason?: string }) => signerFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["signatures"] }); setDetail(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => { toast.success("Cancelado"); qc.invalidateQueries({ queryKey: ["signatures"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["signatures"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setDraft(emptyDraft()); setEditDlg(true); };
  const openEdit = (r: any) => {
    setDraft({
      id: r.id,
      title: r.title,
      description: r.description ?? "",
      document_url: r.document_url ?? "",
      expires_at: r.expires_at ? r.expires_at.slice(0, 10) : "",
      signers: r.signers.length
        ? r.signers.map((s: any) => ({ name: s.name, email: s.email, role: s.role ?? "" }))
        : [{ name: "", email: "", role: "" }],
    });
    setEditDlg(true);
  };

  const totals = data?.totals ?? { draft: 0, sent: 0, signed: 0, declined: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PenLine}
        title="Assinaturas Eletrônicas"
        subtitle="Envie documentos para assinatura e acompanhe cada signatário em tempo real."
        action={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova solicitação</Button>}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Rascunhos</p>
          <p className="text-2xl font-bold">{totals.draft}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Em andamento</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totals.sent}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Assinados</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totals.signed}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Recusados / Expirados</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{totals.declined}</p>
        </CardContent></Card>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="draft">Rascunho</TabsTrigger>
          <TabsTrigger value="sent">Enviados</TabsTrigger>
          <TabsTrigger value="signed">Assinados</TabsTrigger>
          <TabsTrigger value="declined">Recusados</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (data?.requests ?? []).length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
          <PenLine className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Nenhuma solicitação de assinatura.</p>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <div className="divide-y">
            {(data?.requests ?? []).map((r: any) => {
              const pct = r.total_signers > 0 ? Math.round((r.signed_count / r.total_signers) * 100) : 0;
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 hover:bg-accent/30 cursor-pointer"
                  onClick={() => setDetail(r)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate">{r.title}</p>
                      <Badge variant={STATUS_BADGE[r.status]} className="text-[10px]">{STATUS_LABEL[r.status]}</Badge>
                      <span className="text-xs text-muted-foreground">{r.signed_count}/{r.total_signers} assinados</span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden max-w-xs">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {r.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => send.mutate(r.id)} disabled={r.total_signers === 0}>
                        <Send className="h-3 w-3 mr-1" /> Enviar
                      </Button>
                    )}
                    {r.status === "draft" && (
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    )}
                    <Button size="sm" variant="ghost"
                      onClick={() => { if (confirm("Excluir?")) remove.mutate(r.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent></Card>
      )}

      {/* Edit dialog */}
      <Dialog open={editDlg} onOpenChange={setEditDlg}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar solicitação" : "Nova solicitação"}</DialogTitle>
            <DialogDescription>Adicione o documento e os signatários.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Contrato XPTO — Assinatura" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>URL do documento</Label>
                <Input value={draft.document_url}
                  onChange={(e) => setDraft({ ...draft, document_url: e.target.value })}
                  placeholder="https://..." />
              </div>
              <div>
                <Label>Expira em</Label>
                <Input type="date" value={draft.expires_at}
                  onChange={(e) => setDraft({ ...draft, expires_at: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Signatários</Label>
                <Button size="sm" variant="outline"
                  onClick={() => setDraft({ ...draft, signers: [...draft.signers, { name: "", email: "", role: "" }] })}>
                  <UserPlus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {draft.signers.map((s: any, i: number) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <Input placeholder="Nome" value={s.name}
                      onChange={(e) => {
                        const ns = [...draft.signers]; ns[i] = { ...ns[i], name: e.target.value };
                        setDraft({ ...draft, signers: ns });
                      }} />
                    <Input placeholder="email@..." type="email" value={s.email}
                      onChange={(e) => {
                        const ns = [...draft.signers]; ns[i] = { ...ns[i], email: e.target.value };
                        setDraft({ ...draft, signers: ns });
                      }} />
                    <Input placeholder="Papel (opcional)" value={s.role}
                      onChange={(e) => {
                        const ns = [...draft.signers]; ns[i] = { ...ns[i], role: e.target.value };
                        setDraft({ ...draft, signers: ns });
                      }} />
                    <Button size="sm" variant="ghost"
                      onClick={() => setDraft({ ...draft, signers: draft.signers.filter((_: any, j: number) => j !== i) })}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDlg(false)}>Cancelar</Button>
            <Button disabled={!draft.title?.trim() || upsert.isPending} onClick={() => upsert.mutate()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><PenLine className="h-5 w-5" /> {detail.title}</DialogTitle>
                <DialogDescription>
                  <Badge variant={STATUS_BADGE[detail.status]} className="mr-2">{STATUS_LABEL[detail.status]}</Badge>
                  {detail.signed_count}/{detail.total_signers} assinados
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {detail.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}
                {detail.document_url && (
                  <a href={detail.document_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <ExternalLink className="h-4 w-4" /> Abrir documento
                  </a>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Signatários</Label>
                  <div className="mt-2 border rounded-md divide-y">
                    {detail.signers.map((s: any) => (
                      <div key={s.id} className="p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{s.name} {s.role && <span className="text-xs text-muted-foreground">— {s.role}</span>}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {s.email}</p>
                          {s.signed_at && <p className="text-[11px] text-muted-foreground">Assinou em {new Date(s.signed_at).toLocaleString("pt-BR")}</p>}
                          {s.declined_reason && <p className="text-[11px] text-red-600">Recusou: {s.declined_reason}</p>}
                        </div>
                        <Badge variant={s.status === "signed" ? "default" : s.status === "declined" ? "destructive" : "outline"}
                          className="text-[10px]">{SIGNER_LABEL[s.status]}</Badge>
                        {detail.status !== "draft" && s.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost"
                              onClick={() => signerMut.mutate({ signer_id: s.id, status: "viewed" })}>
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost"
                              onClick={() => signerMut.mutate({ signer_id: s.id, status: "signed" })}>
                              <Check className="h-3 w-3 text-emerald-600" />
                            </Button>
                            <Button size="sm" variant="ghost"
                              onClick={() => {
                                const r = prompt("Motivo da recusa?") ?? "";
                                signerMut.mutate({ signer_id: s.id, status: "declined", reason: r });
                              }}>
                              <X className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {["sent", "viewed"].includes(detail.status) && (
                  <Button variant="outline" size="sm" onClick={() => cancel.mutate(detail.id)}>
                    <X className="h-3 w-3 mr-1" /> Cancelar solicitação
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
