import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, UserPlus, Phone, Mail, CheckSquare, Users as UsersIcon, FileText, PauseCircle, PlayCircle, XCircle } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import {
  getSequence, upsertStep, deleteStep, enrollContact, updateEnrollment,
} from "@/lib/sequences.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sequences/$id")({ component: SequenceDetail });

const TYPE_ICONS: Record<string, any> = {
  call: Phone, email: Mail, task: CheckSquare, meeting: UsersIcon, note: FileText,
};

const TYPE_LABELS: Record<string, string> = {
  call: "Ligação", email: "Email", task: "Tarefa", meeting: "Reunião", note: "Nota",
};

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default", completed: "secondary", paused: "outline", cancelled: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa", completed: "Concluída", paused: "Pausada", cancelled: "Cancelada",
};

function SequenceDetail() {
  const { id } = Route.useParams();
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const canManage = useCanManage();
  const fetchSeq = useServerFn(getSequence);
  const upsertStepFn = useServerFn(upsertStep);
  const delStepFn = useServerFn(deleteStep);
  const enrollFn = useServerFn(enrollContact);
  const updateEnrollFn = useServerFn(updateEnrollment);

  const [stepDialog, setStepDialog] = useState(false);
  const [enrollDialog, setEnrollDialog] = useState(false);
  const [stepDraft, setStepDraft] = useState<any>({
    step_order: 1, day_offset: 0, type: "email", subject: "", body: "",
  });
  const [contactSearch, setContactSearch] = useState("");
  const [pickedContact, setPickedContact] = useState<{ id: string; label: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sequence", id],
    queryFn: () => fetchSeq({ data: { id } }),
    enabled: !!id,
  });

  const { data: contactsData } = useQuery({
    queryKey: ["contact-search", orgId, contactSearch],
    enabled: !!orgId && enrollDialog,
    queryFn: async () => {
      let q = supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .eq("organization_id", orgId!)
        .limit(20);
      if (contactSearch.trim()) {
        q = q.or(
          `first_name.ilike.%${contactSearch}%,last_name.ilike.%${contactSearch}%,email.ilike.%${contactSearch}%`,
        );
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  const upsertStepMut = useMutation({
    mutationFn: () =>
      upsertStepFn({
        data: {
          id: stepDraft.id,
          sequence_id: id,
          organization_id: orgId!,
          step_order: Number(stepDraft.step_order),
          day_offset: Number(stepDraft.day_offset),
          type: stepDraft.type,
          subject: stepDraft.subject.trim(),
          body: stepDraft.body?.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Passo salvo");
      setStepDialog(false);
      qc.invalidateQueries({ queryKey: ["sequence", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delStepMut = useMutation({
    mutationFn: (sid: string) => delStepFn({ data: { id: sid } }),
    onSuccess: () => {
      toast.success("Passo removido");
      qc.invalidateQueries({ queryKey: ["sequence", id] });
    },
  });

  const enrollMut = useMutation({
    mutationFn: () =>
      enrollFn({
        data: {
          organization_id: orgId!,
          sequence_id: id,
          contact_id: pickedContact!.id,
        },
      }),
    onSuccess: (r: any) => {
      toast.success(`Contato matriculado — ${r.created} atividades criadas`);
      setEnrollDialog(false);
      setPickedContact(null);
      qc.invalidateQueries({ queryKey: ["sequence", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setStatusMut = useMutation({
    mutationFn: (vars: { id: string; status: "active" | "completed" | "paused" | "cancelled" }) =>
      updateEnrollFn({ data: vars }),
    onSuccess: () => {
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: ["sequence", id] });
    },
  });

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-8 w-64" /><Skeleton className="h-32 w-full" /></div>;
  if (!data?.sequence) return <p className="text-muted-foreground">Sequência não encontrada.</p>;

  const nextOrder = (data.steps[data.steps.length - 1]?.step_order ?? 0) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/sequences"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            {data.sequence.name}
            {data.sequence.active ? (
              <Badge variant="default" className="text-[10px]">Ativa</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">Inativa</Badge>
            )}
          </h1>
          {data.sequence.description && (
            <p className="text-sm text-muted-foreground">{data.sequence.description}</p>
          )}
        </div>
        <Button onClick={() => setEnrollDialog(true)}>
          <UserPlus className="h-4 w-4 mr-1" /> Matricular contato
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Passos ({data.steps.length})</CardTitle>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setStepDraft({ step_order: nextOrder, day_offset: 0, type: "email", subject: "", body: "" });
                setStepDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar passo
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {data.steps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum passo. Adicione o primeiro.</p>
          ) : (
            <div className="space-y-2">
              {data.steps.map((s) => {
                const Icon = TYPE_ICONS[s.type] ?? CheckSquare;
                return (
                  <div key={s.id} className="flex items-start gap-3 p-3 rounded-md border bg-card">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {s.step_order}
                    </div>
                    <Icon className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.subject}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[s.type]}</Badge>
                        <span>Dia +{s.day_offset}</span>
                      </div>
                      {s.body && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{s.body}</p>}
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setStepDraft(s); setStepDialog(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { if (confirm("Remover passo?")) delStepMut.mutate(s.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matrículas ({data.enrollments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum contato matriculado.</p>
          ) : (
            <div className="divide-y">
              {data.enrollments.map((e) => {
                const c = e.contacts;
                const name = c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "—" : "—";
                return (
                  <div key={e.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.enrolled_at).toLocaleDateString("pt-BR")}{c?.email ? ` · ${c.email}` : ""}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE[e.status]} className="text-[10px]">{STATUS_LABEL[e.status]}</Badge>
                    <div className="flex gap-1">
                      {e.status !== "paused" && e.status !== "cancelled" && (
                        <Button variant="ghost" size="sm" onClick={() => setStatusMut.mutate({ id: e.id, status: "paused" })}>
                          <PauseCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {e.status === "paused" && (
                        <Button variant="ghost" size="sm" onClick={() => setStatusMut.mutate({ id: e.id, status: "active" })}>
                          <PlayCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {e.status !== "cancelled" && (
                        <Button variant="ghost" size="sm" onClick={() => setStatusMut.mutate({ id: e.id, status: "cancelled" })}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={stepDialog} onOpenChange={setStepDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{stepDraft.id ? "Editar passo" : "Novo passo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ordem</Label>
                <Input
                  type="number" min={1}
                  value={stepDraft.step_order}
                  onChange={(e) => setStepDraft({ ...stepDraft, step_order: e.target.value })}
                />
              </div>
              <div>
                <Label>Dia (offset)</Label>
                <Input
                  type="number" min={0}
                  value={stepDraft.day_offset}
                  onChange={(e) => setStepDraft({ ...stepDraft, day_offset: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={stepDraft.type} onValueChange={(v) => setStepDraft({ ...stepDraft, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assunto / título</Label>
              <Input
                value={stepDraft.subject}
                onChange={(e) => setStepDraft({ ...stepDraft, subject: e.target.value })}
              />
            </div>
            <div>
              <Label>Corpo / descrição</Label>
              <Textarea
                rows={4}
                value={stepDraft.body ?? ""}
                onChange={(e) => setStepDraft({ ...stepDraft, body: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStepDialog(false)}>Cancelar</Button>
            <Button disabled={!stepDraft.subject?.trim() || upsertStepMut.isPending} onClick={() => upsertStepMut.mutate()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={enrollDialog} onOpenChange={setEnrollDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Matricular contato</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Buscar por nome ou email…"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
            />
            <div className="max-h-60 overflow-auto divide-y rounded-md border">
              {(contactsData ?? []).map((c: any) => {
                const label = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "—";
                const isPicked = pickedContact?.id === c.id;
                return (
                  <button
                    key={c.id}
                    className={`w-full text-left px-3 py-2 hover:bg-accent text-sm ${isPicked ? "bg-accent" : ""}`}
                    onClick={() => setPickedContact({ id: c.id, label })}
                  >
                    <p className="font-medium">{label}</p>
                    {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                  </button>
                );
              })}
              {(contactsData ?? []).length === 0 && (
                <p className="p-3 text-sm text-muted-foreground text-center">Nenhum contato.</p>
              )}
            </div>
            {pickedContact && (
              <p className="text-sm">Selecionado: <strong>{pickedContact.label}</strong></p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollDialog(false)}>Cancelar</Button>
            <Button disabled={!pickedContact || enrollMut.isPending} onClick={() => enrollMut.mutate()}>
              Matricular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
