import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg } from "@/lib/org";
import { RequireManager } from "@/components/require-manager";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Zap, ArrowRight, Sparkles, Trophy, Flame, UserPlus, Clock, Target } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings/automations")({
  component: () => <RequireManager><AutomationsPage /></RequireManager>,
});

const TRIGGERS = [
  { id: "deal.stage_changed", label: "Negócio mudou de estágio" },
  { id: "deal.won", label: "Negócio foi ganho" },
  { id: "deal.lost", label: "Negócio foi perdido" },
  { id: "deal.created", label: "Negócio foi criado" },
  { id: "contact.created", label: "Contato foi criado" },
  { id: "activity.completed", label: "Atividade concluída" },
];

const STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const;

const ACTION_TYPES = [
  { id: "create_activity", label: "Criar atividade" },
  { id: "create_notification", label: "Notificar usuário" },
  { id: "change_deal_stage", label: "Mover negócio de estágio" },
  { id: "assign_owner", label: "Atribuir responsável" },
  { id: "create_recommendation", label: "Gerar recomendação" },
];

const ACTIVITY_TYPES = ["task", "call", "email", "meeting", "note"] as const;

type Template = {
  id: string;
  icon: typeof Zap;
  name: string;
  description: string;
  trigger_event: string;
  conditions: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
};

const TEMPLATES: Template[] = [
  {
    id: "onboarding-won",
    icon: Trophy,
    name: "Onboarding ao ganhar negócio",
    description: "Quando um deal vai para 'won', cria tarefa de kick-off em 1 dia.",
    trigger_event: "deal.stage_changed",
    conditions: { to_stage: "won" },
    action_type: "create_activity",
    action_config: { type: "task", title: "Kick-off de onboarding", description: "Agendar primeira reunião com cliente novo.", due_in_days: 1 },
  },
  {
    id: "recover-lost",
    icon: Flame,
    name: "Recuperar negócio perdido",
    description: "Quando um deal vira 'lost', cria tarefa de reativação em 30 dias.",
    trigger_event: "deal.stage_changed",
    conditions: { to_stage: "lost" },
    action_type: "create_activity",
    action_config: { type: "call", title: "Reativar cliente perdido", description: "Ligar 30 dias depois para reabrir oportunidade.", due_in_days: 30 },
  },
  {
    id: "welcome-contact",
    icon: UserPlus,
    name: "Boas-vindas a novo contato",
    description: "Quando um contato é criado, agenda follow-up em 2 dias.",
    trigger_event: "contact.created",
    conditions: {},
    action_type: "create_activity",
    action_config: { type: "email", title: "E-mail de boas-vindas", description: "Apresentar a empresa e qualificar interesse.", due_in_days: 2 },
  },
  {
    id: "notify-big-deal",
    icon: Target,
    name: "Avisar a equipe de deal grande",
    description: "Quando um deal é criado, notifica o time (configure threshold depois).",
    trigger_event: "deal.created",
    conditions: {},
    action_type: "create_notification",
    action_config: { title: "Novo negócio criado", body: "Verifique se precisa de aprovação ou apoio." },
  },
  {
    id: "followup-proposal",
    icon: Clock,
    name: "Follow-up de proposta enviada",
    description: "Quando deal vai para 'proposal', cria follow-up em 3 dias.",
    trigger_event: "deal.stage_changed",
    conditions: { to_stage: "proposal" },
    action_type: "create_activity",
    action_config: { type: "call", title: "Follow-up de proposta", description: "Confirmar recebimento e tirar dúvidas.", due_in_days: 3 },
  },
  {
    id: "recommend-on-win",
    icon: Sparkles,
    name: "Gerar recomendação no ganho",
    description: "Ao ganhar deal, pede para a IA sugerir próximas ações naquela conta.",
    trigger_event: "deal.won",
    conditions: {},
    action_type: "create_recommendation",
    action_config: { surface: "customer-360" },
  },
];

type AutomationRow = {
  id: string;
  name: string;
  trigger_event: string;
  conditions: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  enabled: boolean;
  run_count: number;
  last_run_at: string | null;
};

function AutomationsPage() {
  const { orgId } = useCurrentOrg();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["automations", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automations")
        .select("id, name, trigger_event, conditions, action_type, action_config, enabled, run_count, last_run_at")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AutomationRow[];
    },
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("automations").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations", orgId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations", orgId] });
      toast.success("Automação removida");
    },
  });

  const applyTemplate = useMutation({
    mutationFn: async (t: Template) => {
      if (!orgId || !user?.id) throw new Error("Sem organização");
      const { error } = await supabase.from("automations").insert({
        organization_id: orgId,
        created_by: user.id,
        name: t.name,
        trigger_event: t.trigger_event,
        conditions: t.conditions as never,
        action_type: t.action_type,
        action_config: t.action_config as never,
        enabled: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations", orgId] });
      toast.success("Automação criada a partir do template");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Automações"
        subtitle="Regras que executam ações automaticamente quando eventos acontecem no CRM."
        action={
          <div className="flex gap-2">
            <Link to="/settings/automations/runs">
              <Button variant="outline"><Zap className="h-4 w-4 mr-2" />Ver execuções</Button>
            </Link>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Nova automação</Button>
              </DialogTrigger>
              <AutomationDialog
                orgId={orgId}
                userId={user?.id ?? null}
                onClose={() => setOpen(false)}
                onSaved={() => {
                  qc.invalidateQueries({ queryKey: ["automations", orgId] });
                  setOpen(false);
                }}
              />
            </Dialog>
          </div>
        }
      />

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Templates prontos</h3>
          <span className="text-xs text-muted-foreground">
            Clique em um para ativar imediatamente — depois edite ou desligue se quiser.
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                disabled={applyTemplate.isPending}
                onClick={() => applyTemplate.mutate(t)}
                className="text-left rounded-md border bg-card hover:bg-accent/40 transition p-3 disabled:opacity-50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium text-sm truncate">{t.name}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-primary">
                  <Plus className="h-3 w-3" /> Aplicar
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-8 text-sm text-muted-foreground">Carregando…</Card>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Nenhuma automação ainda"
          description="Crie regras como: 'quando um negócio for ganho, criar tarefa de onboarding'."
        />
      ) : (
        <div className="space-y-3">
          {rules.map((r) => {
            const triggerLabel = TRIGGERS.find((t) => t.id === r.trigger_event)?.label ?? r.trigger_event;
            const actionLabel = ACTION_TYPES.find((a) => a.id === r.action_type)?.label ?? r.action_type;
            const condBadges = Object.entries(r.conditions ?? {})
              .filter(([, v]) => v !== "" && v !== null && v !== undefined);
            return (
              <Card key={r.id} className="p-4 flex items-center gap-4">
                <Switch
                  checked={r.enabled}
                  onCheckedChange={(v) => toggleEnabled.mutate({ id: r.id, enabled: v })}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{r.name}</p>
                    {r.run_count > 0 && (
                      <Badge variant="secondary" className="text-xs">{r.run_count}× executada</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <span>{triggerLabel}</span>
                    {condBadges.map(([k, v]) => (
                      <Badge key={k} variant="outline" className="text-xs">{k}: {String(v)}</Badge>
                    ))}
                    <ArrowRight className="h-3 w-3" />
                    <span>{actionLabel}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm(`Remover "${r.name}"?`)) remove.mutate(r.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AutomationDialog({
  orgId,
  userId,
  onSaved,
  onClose,
}: {
  orgId: string | null;
  userId: string | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<string>("deal.stage_changed");
  const [toStage, setToStage] = useState<string>("won");
  const [actionType, setActionType] = useState<string>("create_activity");
  // create_activity fields
  const [actType, setActType] = useState<(typeof ACTIVITY_TYPES)[number]>("task");
  const [actTitle, setActTitle] = useState("Acompanhar negócio ganho");
  const [actDescription, setActDescription] = useState("");
  const [actDueInDays, setActDueInDays] = useState("1");
  // create_notification fields
  const [notifTitle, setNotifTitle] = useState("Automação acionada");
  const [notifBody, setNotifBody] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!orgId || !userId) throw new Error("Sem organização");
      if (!name.trim()) throw new Error("Dê um nome para a automação");

      const conditions: Record<string, unknown> = {};
      if (trigger === "deal.stage_changed" && toStage) conditions.to_stage = toStage;

      let action_config: Record<string, unknown> = {};
      if (actionType === "create_activity") {
        action_config = {
          type: actType,
          title: actTitle.trim() || "Tarefa automática",
          description: actDescription.trim() || null,
          due_in_days: Number(actDueInDays) || null,
        };
      } else if (actionType === "create_notification") {
        action_config = {
          title: notifTitle.trim() || "Automação acionada",
          body: notifBody.trim() || null,
        };
      }

      const { error } = await supabase.from("automations").insert({
        organization_id: orgId,
        created_by: userId,
        name: name.trim(),
        trigger_event: trigger,
        conditions: conditions as never,
        action_type: actionType,
        action_config: action_config as never,
        enabled: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Automação criada");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Nova automação</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Onboarding ao ganhar negócio" />
        </div>

        <div className="space-y-2">
          <Label>Quando acontecer</Label>
          <Select value={trigger} onValueChange={setTrigger}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRIGGERS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {trigger === "deal.stage_changed" && (
          <div className="space-y-2">
            <Label>Para o estágio</Label>
            <Select value={toStage} onValueChange={setToStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Então</Label>
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {actionType === "create_activity" && (
          <div className="space-y-3 border-l-2 pl-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={actType} onValueChange={(v) => setActType(v as typeof actType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vence em (dias)</Label>
                <Input type="number" min="0" value={actDueInDays} onChange={(e) => setActDueInDays(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input value={actTitle} onChange={(e) => setActTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea rows={2} value={actDescription} onChange={(e) => setActDescription(e.target.value)} />
            </div>
          </div>
        )}

        {actionType === "create_notification" && (
          <div className="space-y-3 border-l-2 pl-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem (opcional)</Label>
              <Textarea rows={2} value={notifBody} onChange={(e) => setNotifBody(e.target.value)} />
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando…" : "Criar automação"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
