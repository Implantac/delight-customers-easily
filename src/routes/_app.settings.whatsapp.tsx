import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listWAChannels, upsertWAChannel, deleteWAChannel, getWAWebhookUrl,
} from "@/lib/whatsapp-channels.functions";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { RequireManager } from "@/components/require-manager";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { Plus, Trash2, MessageSquare, Copy, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings/whatsapp")({
  component: () => <RequireManager><WhatsAppChannelsPage /></RequireManager>,
});

type Provider = "meta_waba" | "evolution" | "uazapi" | "twilio";
const PROVIDER_LABEL: Record<Provider, string> = {
  meta_waba: "Meta WhatsApp Cloud API",
  evolution: "Evolution API",
  uazapi: "UAZAPI",
  twilio: "Twilio WhatsApp",
};

function WhatsAppChannelsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const list = useServerFn(listWAChannels);
  const upsert = useServerFn(upsertWAChannel);
  const del = useServerFn(deleteWAChannel);
  const getHook = useServerFn(getWAWebhookUrl);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["wa-channels", orgId],
    enabled: !!orgId,
    queryFn: () => list({ data: { organization_id: orgId! } }),
  });

  const save = useMutation({
    mutationFn: async (payload: any) => upsert({ data: { ...payload, organization_id: orgId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa-channels", orgId] });
      setOpen(false); setEditing(null);
      toast.success("Canal salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa-channels", orgId] });
      toast.success("Canal removido");
    },
  });

  async function copyWebhook(id: string) {
    const r = await getHook({ data: { channel_id: id } });
    await navigator.clipboard.writeText(r.url);
    toast.success("URL do webhook copiada");
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-4">
      <PageHeader
        title="Canais de WhatsApp"
        subtitle="Conecte um ou mais números (Meta Cloud API, Evolution, UAZAPI, Twilio). Os tokens são guardados criptografados no backend."
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" />Novo canal</Button>
            </DialogTrigger>
            <ChannelDialog editing={editing} onSubmit={(p) => save.mutate(p)} saving={save.isPending} />
          </Dialog>
        }
      />

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Carregando…</Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nenhum canal configurado"
          description="Adicione um canal para começar a enviar e receber mensagens via WhatsApp."
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((ch: any) => (
            <Card key={ch.id} className="p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span className="font-medium">{ch.display_name}</span>
                  <Badge variant="outline">{PROVIDER_LABEL[ch.provider as Provider]}</Badge>
                  <StatusBadge status={ch.status} />
                  {ch.is_default && <Badge>padrão</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {ch.phone_number ?? ch.instance_name ?? ch.phone_number_id ?? "—"}
                </div>
                {ch.last_error && (
                  <div className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />{ch.last_error}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copyWebhook(ch.id)}>
                  <Copy className="h-3.5 w-3.5 mr-1" />Webhook
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(ch); setOpen(true); }}>
                  Editar
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={() => { if (confirm("Remover canal?")) remove.mutate(ch.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { v: any; label: string }> = {
    active:  { v: "default",     label: "ativo"   },
    paused:  { v: "secondary",   label: "pausado" },
    draft:   { v: "outline",     label: "rascunho"},
    error:   { v: "destructive", label: "erro"    },
  };
  const m = map[status] ?? map.draft;
  return <Badge variant={m.v}>{m.label}</Badge>;
}

function ChannelDialog({
  editing, onSubmit, saving,
}: { editing: any | null; onSubmit: (p: any) => void; saving: boolean }) {
  const [provider, setProvider] = useState<Provider>(editing?.provider ?? "meta_waba");
  const [form, setForm] = useState({
    display_name: editing?.display_name ?? "",
    phone_number: editing?.phone_number ?? "",
    phone_number_id: editing?.phone_number_id ?? "",
    business_account_id: editing?.business_account_id ?? "",
    base_url: editing?.base_url ?? "",
    instance_name: editing?.instance_name ?? "",
    webhook_secret: editing?.webhook_secret ?? "",
    is_default: editing?.is_default ?? false,
    status: (editing?.status ?? "draft") as "draft" | "active" | "paused" | "error",
    credentials_json: "",
  });
  const set = <K extends keyof typeof form>(k: K, v: any) => setForm((s) => ({ ...s, [k]: v }));

  function submit() {
    if (!form.display_name.trim()) { toast.error("Informe um nome"); return; }
    let credentials: Record<string, string> | null | undefined = undefined;
    if (form.credentials_json.trim()) {
      try { credentials = JSON.parse(form.credentials_json); }
      catch { toast.error("JSON de credenciais inválido"); return; }
    }
    onSubmit({
      id: editing?.id,
      provider,
      display_name: form.display_name.trim(),
      phone_number: form.phone_number || null,
      phone_number_id: form.phone_number_id || null,
      business_account_id: form.business_account_id || null,
      base_url: form.base_url || null,
      instance_name: form.instance_name || null,
      webhook_secret: form.webhook_secret || null,
      is_default: form.is_default,
      status: form.status,
      credentials,
    });
  }

  return (
    <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editing ? "Editar canal" : "Novo canal WhatsApp"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label>Provedor</Label>
          <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PROVIDER_LABEL).map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label>Nome do canal</Label>
          <Input value={form.display_name} onChange={(e) => set("display_name", e.target.value)}
            placeholder="Ex: Atendimento Comercial" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Número (E.164)</Label>
            <Input value={form.phone_number} onChange={(e) => set("phone_number", e.target.value)}
              placeholder="+5511999999999" />
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {provider === "meta_waba" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Phone Number ID</Label>
              <Input value={form.phone_number_id} onChange={(e) => set("phone_number_id", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>WABA ID</Label>
              <Input value={form.business_account_id} onChange={(e) => set("business_account_id", e.target.value)} />
            </div>
          </div>
        )}

        {(provider === "evolution" || provider === "uazapi") && (
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Base URL</Label>
              <Input value={form.base_url} onChange={(e) => set("base_url", e.target.value)}
                placeholder="https://api.exemplo.com" />
            </div>
            <div className="grid gap-1.5">
              <Label>Instance Name</Label>
              <Input value={form.instance_name} onChange={(e) => set("instance_name", e.target.value)} />
            </div>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label>Webhook Secret (verificação de assinatura)</Label>
          <Input value={form.webhook_secret} onChange={(e) => set("webhook_secret", e.target.value)}
            placeholder="opcional, depende do provedor" />
        </div>

        <div className="grid gap-1.5">
          <Label>Credenciais (JSON)</Label>
          <Textarea rows={5} value={form.credentials_json}
            onChange={(e) => set("credentials_json", e.target.value)}
            placeholder={credentialsPlaceholder(provider)} />
          <p className="text-xs text-muted-foreground">
            Cole o JSON com as chaves esperadas pelo provedor. Será armazenado criptografado.
            Deixe em branco para manter o atual.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="def">Canal padrão da organização</Label>
          <Switch id="def" checked={form.is_default}
            onCheckedChange={(v) => set("is_default", v)} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function credentialsPlaceholder(p: Provider): string {
  switch (p) {
    case "meta_waba":  return '{ "access_token": "EAAG..." }';
    case "evolution":  return '{ "api_key": "..." }';
    case "uazapi":     return '{ "token": "..." }';
    case "twilio":     return '{ "account_sid": "AC...", "auth_token": "...", "from": "whatsapp:+14155..." }';
  }
}
