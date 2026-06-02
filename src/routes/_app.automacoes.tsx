import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Zap, Plus, Trash2, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import {
  listCommercialAutomations as listAutomations,
  upsertCommercialAutomation as upsertAutomation,
  deleteCommercialAutomation as deleteAutomation,
} from "@/lib/commercial-automations.functions";

export const Route = createFileRoute("/_app/automacoes")({ component: AutomationsPage });

const TRIGGERS: Record<string, { label: string; help: string; needsThreshold: boolean }> = {
  no_purchase_days: { label: "Cliente sem comprar há X dias", help: "Threshold = dias", needsThreshold: true },
  churn_risk_high: { label: "Risco de churn alto", help: "Threshold = score 0-100", needsThreshold: true },
  high_potential_no_visit: { label: "Alto potencial sem visita", help: "Threshold = dias sem visita", needsThreshold: true },
  birthday: { label: "Aniversário do contato", help: "", needsThreshold: false },
  new_lead_no_contact: { label: "Lead novo sem contato", help: "Threshold = dias", needsThreshold: true },
};

const ACTION_LABELS: Record<string, string> = {
  create_task: "Criar tarefa",
  send_whatsapp: "Enviar WhatsApp",
  create_notification: "Notificar no app",
  suggest_visit: "Sugerir visita",
};

function AutomationsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const callList = useServerFn(listAutomations);
  const callUpsert = useServerFn(upsertAutomation);
  const callDelete = useServerFn(deleteAutomation);

  const q = useQuery({
    queryKey: ["automations", orgId],
    enabled: !!orgId,
    queryFn: () => callList({ data: { organization_id: orgId! } }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => callDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["automations"] });
    },
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        icon={Zap}
        title="Automações comerciais"
        subtitle="Regras simples que criam tarefas, notificações ou mensagens automaticamente"
        action={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova regra
          </Button>
        }
      />

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (q.data?.automations ?? []).length === 0 ? (
        <Card className="p-12 text-center">
          <Zap className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Nenhuma automação ainda</p>
          <p className="text-sm text-muted-foreground mt-1">
            Crie regras como "se cliente ficar 90 dias sem comprar, criar tarefa".
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(q.data?.automations ?? []).map((a: any) => (
            <Card key={a.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{a.name}</h3>
                    {!a.enabled && <Badge variant="secondary">Desativada</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {TRIGGERS[a.trigger_type]?.label ?? a.trigger_type}
                    {a.threshold ? ` · ${a.threshold}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
              <div className="flex flex-wrap gap-1">
                {(a.actions ?? []).map((x: any, i: number) => (
                  <Badge key={i} variant="outline">{ACTION_LABELS[x.type] ?? x.type}</Badge>
                ))}
              </div>
              {a.last_run_at && (
                <p className="text-[11px] text-muted-foreground">
                  Última execução: {new Date(a.last_run_at).toLocaleString("pt-BR")} · {a.last_run_matched ?? 0} acionada(s)
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      <AutomationDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        orgId={orgId}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["automations"] });
          setOpen(false);
        }}
        callUpsert={callUpsert}
      />
    </div>
  );
}

function AutomationDialog({
  open, onOpenChange, editing, orgId, onSaved, callUpsert,
}: any) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [trigger, setTrigger] = useState(editing?.trigger_type ?? "no_purchase_days");
  const [threshold, setThreshold] = useState<number>(editing?.threshold ?? 90);
  const [actions, setActions] = useState<string[]>(
    (editing?.actions ?? [{ type: "create_task" }]).map((a: any) => a.type),
  );
  const [template, setTemplate] = useState<string>(editing?.actions?.[0]?.template ?? "");
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);

  // Reset on open with new editing
  // Note: simple approach — re-render on key change in parent if needed.

  const save = useMutation({
    mutationFn: () =>
      callUpsert({
        data: {
          id: editing?.id,
          organization_id: orgId,
          name,
          description: description || null,
          trigger_type: trigger,
          threshold: TRIGGERS[trigger].needsThreshold ? threshold : null,
          actions: actions.map((t) => ({ type: t, template: template || undefined })),
          enabled,
        },
      }),
    onSuccess: () => {
      toast.success(editing ? "Atualizada" : "Criada");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const toggleAction = (t: string) => {
    setActions((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar regra" : "Nova regra"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Reativar cliente parado" />
          </div>
          <div className="space-y-2">
            <Label>Quando (gatilho)</Label>
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TRIGGERS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {TRIGGERS[trigger].help && (
              <p className="text-[11px] text-muted-foreground">{TRIGGERS[trigger].help}</p>
            )}
          </div>
          {TRIGGERS[trigger].needsThreshold && (
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Então fazer</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <Button
                  key={k}
                  type="button"
                  size="sm"
                  variant={actions.includes(k) ? "default" : "outline"}
                  onClick={() => toggleAction(k)}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Mensagem / título (opcional)</Label>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="Ex: Olá {name}, faz tempo que não conversamos!"
              rows={2}
            />
            <p className="text-[11px] text-muted-foreground">Use {"{name}"} para o nome do cliente.</p>
          </div>
          <div className="flex items-center justify-between">
            <Label>Ativa</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !name || actions.length === 0}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
