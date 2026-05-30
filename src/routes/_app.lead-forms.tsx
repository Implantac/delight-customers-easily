import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FormInput, Plus, Pencil, Trash2, Copy, Link2, X, UserPlus, Eye } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import {
  listLeadForms, getLeadFormWithSubmissions, upsertLeadForm,
  deleteLeadForm, deleteLeadSubmission,
} from "@/lib/leadforms.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/lead-forms")({ component: LeadFormsPage });

const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Telefone" },
  { value: "number", label: "Número" },
  { value: "textarea", label: "Texto longo" },
  { value: "select", label: "Seleção" },
];

const DEFAULT_FIELDS = [
  { key: "name", label: "Nome", type: "text", required: true, placeholder: "Seu nome" },
  { key: "email", label: "Email", type: "email", required: true, placeholder: "voce@empresa.com" },
  { key: "phone", label: "Telefone", type: "tel", required: false, placeholder: "(11) 99999-9999" },
  { key: "message", label: "Mensagem", type: "textarea", required: false, placeholder: "Como podemos ajudar?" },
];

function emptyDraft() {
  return {
    slug: "",
    name: "",
    description: "",
    fields: DEFAULT_FIELDS,
    active: true,
    redirect_url: "",
    success_message: "Recebido! Entraremos em contato em breve.",
    create_contact: true,
    create_deal: false,
    default_source: "form",
    notify_emails: "",
  };
}

function LeadFormsPage() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const qc = useQueryClient();
  const listFn = useServerFn(listLeadForms);
  const detailFn = useServerFn(getLeadFormWithSubmissions);
  const upsertFn = useServerFn(upsertLeadForm);
  const delFn = useServerFn(deleteLeadForm);
  const delSubFn = useServerFn(deleteLeadSubmission);

  const [editDlg, setEditDlg] = useState(false);
  const [draft, setDraft] = useState<any>(emptyDraft());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [submissionView, setSubmissionView] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["lead-forms", orgId],
    enabled: !!orgId,
    queryFn: () => listFn({ data: { organization_id: orgId! } }),
  });

  const { data: detail } = useQuery({
    queryKey: ["lead-form", detailId],
    enabled: !!detailId,
    queryFn: () => detailFn({ data: { id: detailId! } }),
  });

  const upsert = useMutation({
    mutationFn: () => upsertFn({
      data: {
        id: draft.id,
        organization_id: orgId!,
        slug: draft.slug,
        name: draft.name.trim(),
        description: draft.description?.trim() || null,
        fields: draft.fields,
        active: draft.active,
        redirect_url: draft.redirect_url?.trim() || null,
        success_message: draft.success_message?.trim() || null,
        create_contact: draft.create_contact,
        create_deal: draft.create_deal,
        default_source: draft.default_source?.trim() || null,
        notify_emails: draft.notify_emails
          ? draft.notify_emails.split(",").map((s: string) => s.trim()).filter(Boolean)
          : null,
      },
    }),
    onSuccess: () => {
      toast.success("Formulário salvo");
      setEditDlg(false);
      qc.invalidateQueries({ queryKey: ["lead-forms"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["lead-forms"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeSub = useMutation({
    mutationFn: (id: string) => delSubFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["lead-form", detailId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setDraft(emptyDraft()); setEditDlg(true); };
  const openEdit = (f: any) => {
    setDraft({
      id: f.id, slug: f.slug, name: f.name,
      description: f.description ?? "",
      fields: f.fields ?? DEFAULT_FIELDS,
      active: f.active,
      redirect_url: f.redirect_url ?? "",
      success_message: f.success_message ?? "",
      create_contact: f.create_contact,
      create_deal: f.create_deal,
      default_source: f.default_source ?? "",
      notify_emails: (f.notify_emails ?? []).join(", "),
    });
    setEditDlg(true);
  };

  const endpointUrl = (slug: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/lead-form`;
  const sampleCurl = (slug: string) =>
    `curl -X POST ${endpointUrl(slug)} \\\n  -H "Content-Type: application/json" \\\n  -d '{"slug":"${slug}","payload":{"name":"João","email":"joao@x.com"}}'`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FormInput className="h-6 w-6" /> Formulários de Captura
          </h1>
          <p className="text-sm text-muted-foreground">
            Endpoints públicos que recebem leads e criam contatos/deals automaticamente.
          </p>
        </div>
        {canManage && <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo formulário</Button>}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (data?.forms ?? []).length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
          <FormInput className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Nenhum formulário criado.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(data?.forms ?? []).map((f: any) => (
            <Card key={f.id} className="cursor-pointer hover:bg-accent/30" onClick={() => setDetailId(f.id)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{f.name}</p>
                      <Badge variant={f.active ? "default" : "outline"} className="text-[10px]">
                        {f.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">/{f.slug}</p>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {canManage && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => { if (confirm("Excluir formulário?")) remove.mutate(f.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{(f.fields ?? []).length} campos</span>
                  <span>•</span>
                  <span>{f.submissions_count} submissões</span>
                  {f.create_contact && <Badge variant="secondary" className="text-[10px]">→ contato</Badge>}
                  {f.create_deal && <Badge variant="secondary" className="text-[10px]">→ deal</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editDlg} onOpenChange={setEditDlg}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar formulário" : "Novo formulário"}</DialogTitle>
            <DialogDescription>Defina campos, automações e URL de retorno.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Nome</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Contato site institucional" />
              </div>
              <div>
                <Label>Slug (único)</Label>
                <Input value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })}
                  placeholder="contato-site" />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>

            <div className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Campos</Label>
                <Button size="sm" variant="outline"
                  onClick={() => setDraft({ ...draft, fields: [...draft.fields, { key: `field_${draft.fields.length + 1}`, label: "Novo campo", type: "text", required: false }] })}>
                  <UserPlus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {draft.fields.map((f: any, i: number) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_120px_auto_auto] gap-2 items-center">
                    <Input placeholder="key" value={f.key}
                      onChange={(e) => {
                        const ns = [...draft.fields]; ns[i] = { ...ns[i], key: e.target.value };
                        setDraft({ ...draft, fields: ns });
                      }} />
                    <Input placeholder="Rótulo" value={f.label}
                      onChange={(e) => {
                        const ns = [...draft.fields]; ns[i] = { ...ns[i], label: e.target.value };
                        setDraft({ ...draft, fields: ns });
                      }} />
                    <Select value={f.type}
                      onValueChange={(v) => {
                        const ns = [...draft.fields]; ns[i] = { ...ns[i], type: v };
                        setDraft({ ...draft, fields: ns });
                      }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Switch checked={!!f.required}
                        onCheckedChange={(c) => {
                          const ns = [...draft.fields]; ns[i] = { ...ns[i], required: c };
                          setDraft({ ...draft, fields: ns });
                        }} />
                      <span className="text-xs text-muted-foreground">Obrig.</span>
                    </div>
                    <Button size="sm" variant="ghost"
                      onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_: any, j: number) => j !== i) })}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border rounded-md p-3 space-y-2">
              <Label className="text-xs uppercase tracking-wide">Automações</Label>
              <div className="flex items-center gap-2">
                <Switch checked={draft.create_contact} onCheckedChange={(c) => setDraft({ ...draft, create_contact: c })} />
                <Label>Criar contato</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={draft.create_deal} onCheckedChange={(c) => setDraft({ ...draft, create_deal: c })} />
                <Label>Criar deal</Label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Origem padrão</Label>
                  <Input value={draft.default_source}
                    onChange={(e) => setDraft({ ...draft, default_source: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Emails para notificar (vírgula)</Label>
                  <Input value={draft.notify_emails}
                    onChange={(e) => setDraft({ ...draft, notify_emails: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Mensagem de sucesso</Label>
                <Input value={draft.success_message}
                  onChange={(e) => setDraft({ ...draft, success_message: e.target.value })} />
              </div>
              <div>
                <Label>URL de redirect</Label>
                <Input value={draft.redirect_url}
                  onChange={(e) => setDraft({ ...draft, redirect_url: e.target.value })}
                  placeholder="https://..." />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={draft.active} onCheckedChange={(c) => setDraft({ ...draft, active: c })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDlg(false)}>Cancelar</Button>
            <Button disabled={!draft.name?.trim() || !draft.slug?.trim() || upsert.isPending}
              onClick={() => upsert.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><FormInput className="h-5 w-5" /> {detail.form.name}</DialogTitle>
                <DialogDescription>/{detail.form.slug} — {detail.submissions.length} submissões</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="border rounded-md p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs flex items-center gap-1"><Link2 className="h-3 w-3" /> Endpoint público</Label>
                    <Button size="sm" variant="ghost"
                      onClick={() => { navigator.clipboard.writeText(sampleCurl(detail.form.slug)); toast.success("Comando copiado"); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">{sampleCurl(detail.form.slug)}</pre>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Submissões recentes</Label>
                  <div className="mt-2 border rounded-md divide-y max-h-96 overflow-y-auto">
                    {detail.submissions.length === 0 ? (
                      <p className="p-6 text-sm text-center text-muted-foreground">Nenhuma submissão ainda.</p>
                    ) : detail.submissions.map((s: any) => (
                      <div key={s.id} className="p-3 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.name ?? s.email ?? "(anônimo)"}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {s.email && <>{s.email} • </>}{new Date(s.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        {s.contact_id && <Badge variant="secondary" className="text-[10px]">contato</Badge>}
                        {s.deal_id && <Badge variant="secondary" className="text-[10px]">deal</Badge>}
                        <Button size="sm" variant="ghost" onClick={() => setSubmissionView(s)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        {canManage && (
                          <Button size="sm" variant="ghost"
                            onClick={() => { if (confirm("Remover submissão?")) removeSub.mutate(s.id); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Submission detail */}
      <Dialog open={!!submissionView} onOpenChange={(o) => !o && setSubmissionView(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payload da submissão</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted/30 p-3 rounded max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
            {submissionView && JSON.stringify(submissionView.payload, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
