import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Plus, Trash2, Webhook, Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings/webhooks")({ component: WebhooksPage });

const EVENTS = [
  { id: "deal.created", label: "Negócio criado" },
  { id: "deal.stage_changed", label: "Negócio mudou de estágio" },
  { id: "deal.won", label: "Negócio ganho" },
  { id: "deal.lost", label: "Negócio perdido" },
  { id: "activity.completed", label: "Atividade concluída" },
  { id: "contact.created", label: "Contato criado" },
];

function WebhooksPage() {
  const { user } = useAuth();
  const { orgId, role } = useCurrentOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const canManage = role === "owner" || role === "admin";

  const { data: hooks } = useQuery({
    queryKey: ["webhooks", orgId],
    enabled: !!orgId,
    queryFn: async () => (await supabase.from("webhooks").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const [selected, setSelected] = useState<string[]>(["deal.stage_changed"]);

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      if (!orgId || !user) throw new Error("Sem organização");
      const name = String(form.get("name") ?? "").trim();
      const url = String(form.get("url") ?? "").trim();
      if (!name || !url) throw new Error("Preencha nome e URL");
      if (!/^https?:\/\//.test(url)) throw new Error("URL deve começar com http(s)://");
      if (selected.length === 0) throw new Error("Selecione ao menos um evento");
      const { error } = await supabase.from("webhooks").insert({
        organization_id: orgId, created_by: user.id, name, url, events: selected,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); setOpen(false); setSelected(["deal.stage_changed"]); toast.success("Webhook criado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("webhooks").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); toast.success("Removido"); },
  });

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        title="Webhooks"
        subtitle="Receba notificações HTTP quando eventos acontecerem no CRM"
        action={canManage ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo webhook</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo webhook</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); create.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
                <div className="space-y-1.5"><Label>Nome *</Label><Input name="name" required maxLength={80} placeholder="Zapier - novos negócios" /></div>
                <div className="space-y-1.5"><Label>URL *</Label><Input name="url" type="url" required placeholder="https://hooks.zapier.com/..." /></div>
                <div className="space-y-2">
                  <Label>Eventos *</Label>
                  <div className="grid gap-1.5 rounded-md border p-3">
                    {EVENTS.map((ev) => (
                      <label key={ev.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.includes(ev.id)}
                          onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, ev.id] : prev.filter((x) => x !== ev.id))}
                          className="h-4 w-4 rounded border-input"
                        />
                        <code className="text-xs text-muted-foreground">{ev.id}</code>
                        <span className="text-muted-foreground">·</span>
                        <span>{ev.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Criar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      {!canManage && <p className="mt-4 text-sm text-muted-foreground">Apenas administradores podem gerenciar webhooks.</p>}

      <div className="mt-6 space-y-3">
        {(hooks ?? []).length === 0 && (
          <EmptyState icon={Webhook} title="Sem webhooks" description="Conecte Zapier, Make, n8n ou seu próprio endpoint para receber eventos do CRM em tempo real." />
        )}
        {hooks?.map((h) => (
          <Card key={h.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{h.name}</h3>
                  {h.enabled ? <Badge variant="secondary">Ativo</Badge> : <Badge variant="outline">Desativado</Badge>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{h.url}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(h.events ?? []).map((ev: string) => <Badge key={ev} variant="outline" className="text-[10px]">{ev}</Badge>)}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Segredo HMAC:</span>
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    {revealed[h.id] ? h.secret : "•".repeat(12)}
                  </code>
                  <button type="button" onClick={() => setRevealed((r) => ({ ...r, [h.id]: !r[h.id] }))} className="text-muted-foreground hover:text-foreground">
                    {revealed[h.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(h.secret); toast.success("Copiado"); }} className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <Switch checked={h.enabled} onCheckedChange={(v) => toggle.mutate({ id: h.id, enabled: v })} />
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remover webhook?")) del.mutate(h.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-5 text-sm">
        <h3 className="font-semibold">Como funciona</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Cada evento gera um <code className="rounded bg-muted px-1">POST</code> JSON para a URL configurada.</li>
          <li>O cabeçalho <code className="rounded bg-muted px-1">X-Lovable-Signature</code> contém um HMAC-SHA256 do corpo, assinado com o segredo do webhook.</li>
          <li>Verifique a assinatura no seu endpoint antes de processar.</li>
        </ul>
      </Card>
    </div>
  );
}
