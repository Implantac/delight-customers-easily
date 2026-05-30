import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import {
  getErpIntegration, saveErpIntegration, deleteErpIntegration,
  testErpConnection, listIntegrationStatus,
} from "@/lib/erp.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plug, CheckCircle2, AlertCircle, Trash2, RefreshCw, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_app/integrations")({ component: IntegrationsPage });

function IntegrationsPage() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const qc = useQueryClient();

  const getIntegration = useServerFn(getErpIntegration);
  const save = useServerFn(saveErpIntegration);
  const remove = useServerFn(deleteErpIntegration);
  const test = useServerFn(testErpConnection);
  const status = useServerFn(listIntegrationStatus);

  const { data: integData } = useQuery({
    queryKey: ["erp-integration", orgId],
    queryFn: () => getIntegration({ data: { organization_id: orgId!, provider: "omie" } }),
    enabled: !!orgId && canManage,
  });

  const { data: statusData } = useQuery({
    queryKey: ["erp-status", orgId],
    queryFn: () => status({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (integData?.integration) {
      setAppKey(integData.integration.app_key);
      setAppSecret(integData.integration.app_secret);
      setActive(integData.integration.is_active);
    }
  }, [integData?.integration?.id]);

  const saveMut = useMutation({
    mutationFn: () => save({
      data: { organization_id: orgId!, provider: "omie", app_key: appKey, app_secret: appSecret, is_active: active },
    }),
    onSuccess: () => {
      toast.success("Credenciais salvas");
      qc.invalidateQueries({ queryKey: ["erp-integration", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: () => test({ data: { organization_id: orgId! } }),
    onSuccess: () => toast.success("Conexão com o Omie validada"),
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  const removeMut = useMutation({
    mutationFn: () => remove({ data: { organization_id: orgId!, provider: "omie" } }),
    onSuccess: () => {
      toast.success("Integração removida");
      setAppKey(""); setAppSecret(""); setActive(true);
      qc.invalidateQueries({ queryKey: ["erp-integration", orgId] });
    },
  });

  const integ = integData?.integration;

  if (!canManage) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Apenas administradores podem gerenciar integrações ERP.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Plug className="h-6 w-6" /> Integrações ERP
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte seu CRM ao seu ERP para sincronizar cadastros sem duplicar trabalho.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Omie
                {integ ? (
                  <Badge variant={integ.is_active ? "default" : "secondary"}>
                    {integ.is_active ? "Ativa" : "Desativada"}
                  </Badge>
                ) : (
                  <Badge variant="outline">Não configurada</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Sincronize Contatos e Empresas do CRM como Clientes no Omie.
              </CardDescription>
            </div>
            <a
              href="https://developer.omie.com.br/my-apps/"
              target="_blank" rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Onde gerar as chaves <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="app_key">App Key</Label>
              <Input id="app_key" value={appKey} onChange={(e) => setAppKey(e.target.value)} placeholder="000000000000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app_secret">App Secret</Label>
              <Input id="app_secret" type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="active">Integração ativa</Label>
          </div>

          {integ?.last_error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" />
              <div>
                <div className="font-medium text-destructive">Último erro</div>
                <div className="text-muted-foreground">{integ.last_error}</div>
              </div>
            </div>
          )}
          {integ?.last_sync_at && !integ.last_error && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Última sincronização: {new Date(integ.last_sync_at).toLocaleString("pt-BR")}
            </div>
          )}

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !appKey || !appSecret}>
              {integ ? "Atualizar credenciais" : "Salvar credenciais"}
            </Button>
            <Button variant="outline" onClick={() => testMut.mutate()} disabled={!integ || testMut.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${testMut.isPending ? "animate-spin" : ""}`} />
              Testar conexão
            </Button>
            {integ && (
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeMut.mutate()}>
                <Trash2 className="h-4 w-4 mr-2" />
                Remover
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contatos sincronizados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {statusData?.contacts.synced ?? 0}
              <span className="text-base text-muted-foreground"> / {statusData?.contacts.total ?? 0}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Use o botão “Enviar ao Omie” na ficha do contato para sincronizar.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empresas sincronizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {statusData?.companies.synced ?? 0}
              <span className="text-base text-muted-foreground"> / {statusData?.companies.total ?? 0}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Use o botão “Enviar ao Omie” na ficha da empresa para sincronizar.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
