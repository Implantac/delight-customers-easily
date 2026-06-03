import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import {
  listSiteChatKeys,
  createSiteChatKey,
  toggleSiteChatKey,
} from "@/lib/site-chat.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Settings as SettingsIcon, Plus, Copy, Code2 } from "lucide-react";

export const Route = createFileRoute("/_app/settings/site-chat")({
  component: SiteChatSettingsPage,
});

function SiteChatSettingsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const listFn = useServerFn(listSiteChatKeys);
  const createFn = useServerFn(createSiteChatKey);
  const toggleFn = useServerFn(toggleSiteChatKey);

  const [label, setLabel] = useState("Meu site");
  const [origins, setOrigins] = useState("");

  const keys = useQuery({
    queryKey: ["site-chat-keys", orgId],
    queryFn: () => listFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          organization_id: orgId!,
          label,
          allowed_origins: origins.split(",").map((s) => s.trim()).filter(Boolean),
        },
      }),
    onSuccess: () => {
      setLabel("Meu site");
      setOrigins("");
      toast.success("Chave criada");
      qc.invalidateQueries({ queryKey: ["site-chat-keys", orgId] });
    },
    onError: (e: any) => toast.error("Falha ao criar", { description: e?.message }),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site-chat-keys", orgId] }),
  });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const snippet = (key: string) =>
    `<script async src="${baseUrl}/api/public/site-chat-widget.js" data-site-key="${key}" data-api="${baseUrl}"></script>`;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        icon={SettingsIcon}
        title="Chat do Site — Widget"
        subtitle="Gere uma chave pública e cole o snippet no HTML do seu site"
      />

      <Card>
        <CardHeader>
          <CardTitle>Nova chave</CardTitle>
          <CardDescription>Cada site recebe uma chave pública. Restrinja por domínio para evitar uso indevido.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome (identificação interna)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
            </div>
            <div>
              <Label>Domínios autorizados (separados por vírgula, opcional)</Label>
              <Input
                value={origins}
                onChange={(e) => setOrigins(e.target.value)}
                placeholder="meusite.com.br, www.meusite.com.br"
              />
            </div>
          </div>
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !label.trim()}>
            <Plus className="h-4 w-4 mr-2" /> Gerar chave
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(keys.data ?? []).map((k: any) => (
          <Card key={k.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {k.label}
                    {!k.is_active && <Badge variant="secondary">desativada</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Domínios:{" "}
                    {k.allowed_origins?.length ? k.allowed_origins.join(", ") : <em>todos (sem restrição)</em>}
                  </div>
                </div>
                <Switch
                  checked={k.is_active}
                  onCheckedChange={(v) => toggleMut.mutate({ id: k.id, is_active: v })}
                />
              </div>
              <div className="rounded-md bg-muted p-3 font-mono text-xs flex items-start justify-between gap-2">
                <code className="break-all">{snippet(k.public_key)}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(snippet(k.public_key));
                    toast.success("Copiado");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Code2 className="h-3 w-3" /> Cole esse snippet antes do <code>&lt;/body&gt;</code> do seu site.
              </p>
            </CardContent>
          </Card>
        ))}
        {keys.data && keys.data.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma chave criada ainda. Gere a primeira acima.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
