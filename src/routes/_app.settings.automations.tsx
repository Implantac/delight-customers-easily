import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, Trash2, Zap, ArrowRight } from "lucide-react";
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
];

const ACTIVITY_TYPES = ["task", "call", "email", "meeting", "note"] as const;

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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Automações"
        subtitle="Regras que executam ações automaticamente quando eventos acontecem no CRM."
        action={
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
        }
      />

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
