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
import { Zap, Plus, Trash2, Edit3, PlayCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import {
  listCommercialAutomations as listAutomations,
  upsertCommercialAutomation as upsertAutomation,
  deleteCommercialAutomation as deleteAutomation,
  runCommercialAutomationsNow,
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

type Recipe = {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  threshold: number | null;
  actions: { type: string; template?: string }[];
};

const RECIPES: Recipe[] = [
  {
    id: "reativar-60d",
    name: "Reativar cliente parado (60 dias)",
    description: "Cria tarefa para o representante e sugere mensagem no WhatsApp.",
    trigger_type: "no_purchase_days",
    threshold: 60,
    actions: [
      { type: "create_task", template: "Reativar {name} — sem compra há 60 dias" },
      { type: "send_whatsapp", template: "Olá {name}, faz um tempo! Posso te mostrar o que chegou de novo?" },
    ],
  },
  {
    id: "churn-alto",
    name: "Risco de churn alto",
    description: "Notifica o app e cria tarefa quando o score de churn passa de 70.",
    trigger_type: "churn_risk_high",
    threshold: 70,
    actions: [
      { type: "create_notification", template: "{name} está com alto risco de churn" },
      { type: "create_task", template: "Ligar para {name} — risco de churn" },
    ],
  },
  {
    id: "potencial-sem-visita",
    name: "Alto potencial sem visita (30 dias)",
    description: "Sugere visita ao representante responsável.",
    trigger_type: "high_potential_no_visit",
    threshold: 30,
    actions: [{ type: "suggest_visit", template: "Visitar {name} — alto potencial" }],
  },
  {
    id: "aniversario",
    name: "Aniversário do contato",
    description: "Mensagem automática de aniversário no WhatsApp.",
    trigger_type: "birthday",
    threshold: null,
    actions: [{ type: "send_whatsapp", template: "Feliz aniversário, {name}! 🎉" }],
  },
  {
    id: "lead-novo",
    name: "Lead novo sem contato em 1 dia",
    description: "Cria tarefa urgente para o vendedor responder rápido.",
    trigger_type: "new_lead_no_contact",
    threshold: 1,
    actions: [{ type: "create_task", template: "Responder lead {name} (SLA 24h)" }],
  },
];

function AutomationsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const callList = useServerFn(listAutomations);
  const callUpsert = useServerFn(upsertAutomation);
  const callDelete = useServerFn(deleteAutomation);
  const callRunNow = useServerFn(runCommercialAutomationsNow);

  const q = useQuery({
    queryKey: ["automations", orgId],
    enabled: !!orgId,
    queryFn: () => callList({ data: { organization_id: orgId! } }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [prefill, setPrefill] = useState<Recipe | null>(null);
  const [recipesOpen, setRecipesOpen] = useState(false);

  const del = useMutation({
    mutationFn: (id: string) => callDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["automations"] });
    },
  });

  const runNow = useMutation({
    mutationFn: () => callRunNow({ data: { organization_id: orgId! } }),
    onSuccess: (r: any) => {
      toast.success(`Executou ${r.rules ?? 0} regra(s) · ${r.matched ?? 0} ação(ões) disparada(s)`);
      qc.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao executar"),
  });

  const useRecipe = (r: Recipe) => {
    setEditing(null);
    setPrefill(r);
    setRecipesOpen(false);
    setOpen(true);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        icon={Zap}
        title="Automações comerciais"
        subtitle="Regras simples que criam tarefas, notificações ou mensagens automaticamente"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRecipesOpen(true)}>
              <Sparkles className="h-4 w-4 mr-1" /> Receitas prontas
            </Button>
            <Button
              variant="outline"
              onClick={() => runNow.mutate()}
              disabled={!orgId || runNow.isPending}
            >
              <PlayCircle className="h-4 w-4 mr-1" />
              {runNow.isPending ? "Executando…" : "Executar agora"}
            </Button>
            <Button onClick={() => { setEditing(null); setPrefill(null); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova regra
            </Button>
          </div>
        }
      />

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (q.data?.automations ?? []).length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Zap className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="font-medium">Nenhuma automação ainda</p>
          <p className="text-sm text-muted-foreground">
            Comece com uma receita pronta ou crie sua própria regra.
          </p>
          <Button variant="outline" onClick={() => setRecipesOpen(true)}>
            <Sparkles className="h-4 w-4 mr-1" /> Ver receitas
          </Button>
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
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setPrefill(null); setOpen(true); }}>
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

      <Dialog open={recipesOpen} onOpenChange={setRecipesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Receitas prontas
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {RECIPES.map((r) => (
              <Card key={r.id} className="p-3 space-y-2 hover:border-primary/50 transition-colors">
                <h4 className="font-medium text-sm">{r.name}</h4>
                <p className="text-xs text-muted-foreground">{r.description}</p>
                <div className="flex flex-wrap gap-1">
                  {r.actions.map((a, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {ACTION_LABELS[a.type] ?? a.type}
                    </Badge>
                  ))}
                </div>
                <Button size="sm" className="w-full" onClick={() => useRecipe(r)}>
                  Usar esta receita
                </Button>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AutomationDialog
        key={editing?.id ?? prefill?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        prefill={prefill}
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
  open, onOpenChange, editing, prefill, orgId, onSaved, callUpsert,
}: any) {
  const seed = editing ?? prefill ?? null;
  const [name, setName] = useState(seed?.name ?? "");
  const [description, setDescription] = useState(seed?.description ?? "");
  const [trigger, setTrigger] = useState(seed?.trigger_type ?? "no_purchase_days");
  const [threshold, setThreshold] = useState<number>(seed?.threshold ?? 90);
  const [actions, setActions] = useState<string[]>(
    (seed?.actions ?? [{ type: "create_task" }]).map((a: any) => a.type),
  );
  const [template, setTemplate] = useState<string>(seed?.actions?.[0]?.template ?? "");
  const [enabled, setEnabled] = useState(seed?.enabled ?? true);

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
