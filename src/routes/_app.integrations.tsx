import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import {
  getErpIntegration, saveErpIntegration, deleteErpIntegration,
  testErpConnection,
} from "@/lib/erp.functions";
import { ERP_CATALOG, getErpHealth, type ErpProviderCatalog } from "@/lib/erp-hub.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Plug, CheckCircle2, AlertCircle, Trash2, RefreshCw, ExternalLink,
  Activity, Database, Cloud, Server, FileText, Sparkles, ArrowRight,
  Wifi, WifiOff, Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_app/integrations")({ component: ErpHubPage });

// ============================================================================
// Página principal — ERP Connect Hub
// ============================================================================

function ErpHubPage() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const [wizardProvider, setWizardProvider] = useState<ErpProviderCatalog | null>(null);

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
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Plug className="h-6 w-6" /> ERP Connect Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Catálogo universal de ERPs. Configure, valide e monitore sincronizações
            sem sair do CRM. Cada ERP tem método próprio (API, banco, agente, CSV/XML).
          </p>
        </div>
      </div>

      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog">
            <Cloud className="h-4 w-4 mr-2" /> Catálogo
          </TabsTrigger>
          <TabsTrigger value="health">
            <Activity className="h-4 w-4 mr-2" /> Health Center
          </TabsTrigger>
          <TabsTrigger value="mappings">
            <Database className="h-4 w-4 mr-2" /> Mapeamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          <CatalogTab orgId={orgId} onConfigure={setWizardProvider} />
        </TabsContent>
        <TabsContent value="health">
          <HealthTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="mappings">
          <MappingsTab />
        </TabsContent>
      </Tabs>

      <Sheet open={!!wizardProvider} onOpenChange={(o) => !o && setWizardProvider(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {wizardProvider && (
            <ConnectWizard
              provider={wizardProvider}
              orgId={orgId}
              onClose={() => setWizardProvider(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ============================================================================
// Catálogo de ERPs
// ============================================================================

function CatalogTab({ orgId, onConfigure }: { orgId: string | null; onConfigure: (p: ErpProviderCatalog) => void }) {
  const getHealth = useServerFn(getErpHealth);
  const { data } = useQuery({
    queryKey: ["erp-health", orgId],
    queryFn: () => getHealth({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 60_000,
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ERP_CATALOG.map((p) => {
        const h = data?.rows.find((r) => r.provider === p.id);
        return (
          <Card key={p.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {providerIcon(p)}
                  {p.name}
                </CardTitle>
                <ProviderStatusBadge provider={p} health={h} />
              </div>
              <CardDescription className="text-xs">{p.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <div className="flex flex-wrap gap-1">
                {p.methods.map((m) => (
                  <Badge key={m} variant="outline" className="text-[10px] uppercase tracking-wide">
                    {labelMethod(m)}
                  </Badge>
                ))}
              </div>
              {h?.is_configured && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {h.last_sync_at && (
                    <div>Última sync: {new Date(h.last_sync_at).toLocaleString("pt-BR")}</div>
                  )}
                  {h.latency_ms != null && (
                    <div>Latência: {h.latency_ms}ms</div>
                  )}
                </div>
              )}
              <Button
                size="sm"
                variant={h?.is_configured ? "outline" : "default"}
                disabled={p.status === "soon"}
                onClick={() => onConfigure(p)}
                className="w-full"
              >
                {p.status === "soon"
                  ? "Em breve"
                  : h?.is_configured
                  ? "Gerenciar"
                  : "Conectar"}
                {p.status !== "soon" && <ArrowRight className="h-3.5 w-3.5 ml-1.5" />}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function providerIcon(p: ErpProviderCatalog) {
  if (p.category === "cloud") return <Cloud className="h-4 w-4 text-muted-foreground" />;
  if (p.category === "on-premise") return <Server className="h-4 w-4 text-muted-foreground" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

function labelMethod(m: string): string {
  return { api: "API", db: "DB", agent: "Agente", csv: "CSV", xml: "XML" }[m] ?? m;
}

function ProviderStatusBadge({
  provider, health,
}: { provider: ErpProviderCatalog; health?: { status: string; is_configured: boolean } }) {
  if (provider.status === "soon") return <Badge variant="secondary">Em breve</Badge>;
  if (!health?.is_configured) return <Badge variant="outline">Não configurado</Badge>;
  if (health.status === "online") return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Online</Badge>;
  if (health.status === "degraded") return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Degradado</Badge>;
  if (health.status === "offline") return <Badge variant="destructive">Offline</Badge>;
  return <Badge variant="outline">Inativo</Badge>;
}

// ============================================================================
// Health Center
// ============================================================================

function HealthTab({ orgId }: { orgId: string | null }) {
  const getHealth = useServerFn(getErpHealth);
  const qc = useQueryClient();
  const { data, isFetching } = useQuery({
    queryKey: ["erp-health", orgId],
    queryFn: () => getHealth({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 60_000,
  });

  const rows = data?.rows ?? [];
  const configured = rows.filter((r) => r.is_configured);
  const online = configured.filter((r) => r.status === "online").length;
  const issues = configured.filter((r) => r.status === "degraded" || r.status === "offline").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="ERPs conectados" value={configured.length} icon={<Plug className="h-4 w-4" />} />
        <KpiCard label="Online" value={online} icon={<Wifi className="h-4 w-4 text-emerald-500" />} />
        <KpiCard label="Com problemas" value={issues} icon={<WifiOff className="h-4 w-4 text-amber-500" />} tone={issues > 0 ? "warn" : "default"} />
        <KpiCard
          label="Última checagem"
          value={isFetching ? "Atualizando…" : "Agora"}
          icon={<RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />}
        />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Status por provedor</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => qc.invalidateQueries({ queryKey: ["erp-health", orgId] })}
          disabled={isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Re-checar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {rows.map((r) => {
              const cat = ERP_CATALOG.find((c) => c.id === r.provider)!;
              const pct = r.contacts_total
                ? Math.round((r.contacts_synced / r.contacts_total) * 100)
                : 0;
              return (
                <div key={r.provider} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-3 flex items-center gap-2">
                    {providerIcon(cat)}
                    <div>
                      <div className="font-medium text-sm">{cat.name}</div>
                      <div className="text-xs text-muted-foreground">{cat.category}</div>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <ProviderStatusBadge provider={cat} health={r} />
                  </div>
                  <div className="md:col-span-2 text-xs">
                    <div className="text-muted-foreground">Latência</div>
                    <div className="font-medium">{r.latency_ms != null ? `${r.latency_ms}ms` : "—"}</div>
                  </div>
                  <div className="md:col-span-2 text-xs">
                    <div className="text-muted-foreground">Última sync</div>
                    <div className="font-medium">
                      {r.last_sync_at ? new Date(r.last_sync_at).toLocaleString("pt-BR") : "Nunca"}
                    </div>
                  </div>
                  <div className="md:col-span-3 text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Cobertura</span>
                      <span className="font-medium">{r.contacts_synced + r.companies_synced} / {r.contacts_total + r.companies_total}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                  {r.last_error && (
                    <div className="md:col-span-12 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-destructive shrink-0" />
                      <span className="text-destructive">{r.last_error}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon, tone = "default" }: {
  label: string; value: number | string; icon: React.ReactNode; tone?: "default" | "warn";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className={`text-2xl font-semibold mt-1 ${tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Mapeamentos (placeholder com explicação)
// ============================================================================

function MappingsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Mapeamento de campos com IA
        </CardTitle>
        <CardDescription>
          Após conectar um ERP, a IA detecta a estrutura de dados e sugere o
          mapeamento campo-a-campo entre o CRM e o ERP.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-md border bg-muted/30 p-4 space-y-2">
          <div className="font-medium">Como funciona</div>
          <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-xs">
            <li>Conecte o ERP no Catálogo.</li>
            <li>A IA lê uma amostra das tabelas e propõe mapeamentos (ex.: <code>contacts.email → Cliente.email</code>).</li>
            <li>Você aceita, ajusta ou cria regras de transformação (uppercase, máscara, default).</li>
            <li>Validação em 10 registros antes do sync completo.</li>
            <li>Conflitos resolvidos por last-write-wins por campo, com override manual no Health Center.</li>
          </ol>
        </div>
        <div className="text-xs text-muted-foreground">
          O mapeamento dinâmico será habilitado quando você conectar o primeiro ERP além do Omie.
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Wizard de conexão (7 passos)
// ============================================================================

const WIZARD_STEPS = [
  "Provedor",
  "Método",
  "Credenciais",
  "Testar",
  "Detectar",
  "Mapear",
  "Sincronizar",
] as const;

function ConnectWizard({
  provider, orgId, onClose,
}: { provider: ErpProviderCatalog; orgId: string | null; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState(provider.methods[0]);
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [active, setActive] = useState(true);
  const [testResult, setTestResult] = useState<null | "ok" | "fail">(null);
  const [testError, setTestError] = useState<string | null>(null);

  const qc = useQueryClient();
  const getIntegration = useServerFn(getErpIntegration);
  const save = useServerFn(saveErpIntegration);
  const remove = useServerFn(deleteErpIntegration);
  const test = useServerFn(testErpConnection);

  const { data: integData } = useQuery({
    queryKey: ["erp-integration", orgId, provider.id],
    queryFn: () => getIntegration({ data: { organization_id: orgId!, provider: provider.id as "omie" } }),
    enabled: !!orgId && provider.id === "omie",
  });

  useEffect(() => {
    if (integData?.integration) {
      setAppKey(integData.integration.app_key);
      setAppSecret(integData.integration.app_secret);
      setActive(integData.integration.is_active);
    }
  }, [integData?.integration?.id]);

  const saveMut = useMutation({
    mutationFn: () => save({
      data: { organization_id: orgId!, provider: provider.id as "omie", app_key: appKey, app_secret: appSecret, is_active: active },
    }),
    onSuccess: () => {
      toast.success("Credenciais salvas");
      qc.invalidateQueries({ queryKey: ["erp-integration", orgId, provider.id] });
      qc.invalidateQueries({ queryKey: ["erp-health", orgId] });
      setStep(3);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: () => test({ data: { organization_id: orgId! } }),
    onSuccess: () => { setTestResult("ok"); setTestError(null); toast.success("Conexão validada"); },
    onError: (e: Error) => { setTestResult("fail"); setTestError(e.message); },
  });

  const removeMut = useMutation({
    mutationFn: () => remove({ data: { organization_id: orgId!, provider: provider.id as "omie" } }),
    onSuccess: () => {
      toast.success("Integração removida");
      setAppKey(""); setAppSecret("");
      qc.invalidateQueries({ queryKey: ["erp-integration", orgId, provider.id] });
      qc.invalidateQueries({ queryKey: ["erp-health", orgId] });
      onClose();
    },
  });

  const progress = useMemo(() => Math.round(((step + 1) / WIZARD_STEPS.length) * 100), [step]);
  const integ = integData?.integration;
  const isOmie = provider.id === "omie";

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {providerIcon(provider)} Conectar {provider.name}
        </SheetTitle>
        <SheetDescription>{provider.description}</SheetDescription>
      </SheetHeader>

      <div className="mt-4 space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Passo {step + 1} de {WIZARD_STEPS.length}: <strong className="text-foreground">{WIZARD_STEPS[step]}</strong></span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="mt-6 space-y-4 min-h-[300px]">
        {step === 0 && (
          <div className="space-y-3">
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="text-sm font-medium">{provider.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{provider.description}</div>
              <Badge variant="outline" className="mt-2 text-[10px]">{provider.category}</Badge>
            </div>
            {provider.docsUrl && (
              <a href={provider.docsUrl} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Documentação oficial <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <Label>Método de conexão</Label>
            {provider.methods.map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`w-full text-left rounded-md border p-3 text-sm transition ${
                  method === m ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <div className="font-medium">{labelMethod(m)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {m === "api" && "Conexão direta via API REST do ERP."}
                  {m === "db" && "Leitura direta no banco de dados (apenas on-premise)."}
                  {m === "agent" && "Agente local instalado na rede do cliente."}
                  {m === "csv" && "Importação periódica de arquivos CSV."}
                  {m === "xml" && "Importação de XML (NFe, pedidos, cadastros)."}
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {!isOmie ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Configuração de credenciais para <strong>{provider.name}</strong> estará
                disponível em breve. Por enquanto, apenas Omie é totalmente suportado.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="app_key">App Key</Label>
                  <Input id="app_key" value={appKey} onChange={(e) => setAppKey(e.target.value)} placeholder="000000000000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="app_secret">App Secret</Label>
                  <Input id="app_secret" type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="active" checked={active} onCheckedChange={setActive} />
                  <Label htmlFor="active">Integração ativa</Label>
                </div>
                {provider.docsUrl && (
                  <a href={provider.docsUrl} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    Onde gerar as chaves <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Button
              onClick={() => testMut.mutate()}
              disabled={!isOmie || !integ || testMut.isPending}
              className="w-full"
            >
              {testMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Testar conexão
            </Button>
            {testResult === "ok" && (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                <div>
                  <div className="font-medium text-emerald-700 dark:text-emerald-400">Conexão validada</div>
                  <div className="text-xs text-muted-foreground">Pronto para detectar a estrutura.</div>
                </div>
              </div>
            )}
            {testResult === "fail" && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  <div className="font-medium text-destructive">Falhou</div>
                  <div className="text-xs text-muted-foreground">{testError}</div>
                </div>
              </div>
            )}
            {!integ && (
              <p className="text-xs text-muted-foreground">Salve as credenciais antes de testar (volte ao passo 3).</p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="rounded-md border p-3">
              <div className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Estrutura detectada
              </div>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                <li>• <strong>Clientes</strong> — {isOmie ? "razao_social, cnpj_cpf, email, telefone1_numero" : "(detecção quando conectado)"}</li>
                <li>• <strong>Produtos</strong> — codigo, descricao, valor_unitario</li>
                <li>• <strong>Pedidos</strong> — numero_pedido, data, total, cliente_id</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              A IA lê uma amostra da API e identifica as entidades disponíveis.
            </p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Mapeamento sugerido</div>
            <div className="rounded-md border divide-y text-xs">
              {[
                ["contacts.name", "razao_social"],
                ["contacts.email", "email"],
                ["contacts.phone", "telefone1_numero"],
                ["companies.name", "nome_fantasia"],
                ["companies.cnpj", "cnpj_cpf"],
              ].map(([from, to]) => (
                <div key={from} className="p-2 flex items-center justify-between">
                  <code className="text-muted-foreground">{from}</code>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <code className="text-foreground">{to}</code>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Você poderá ajustar transformações (uppercase, máscara CNPJ, defaults) em uma próxima versão.
            </p>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
              <div className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Pronto para sincronizar
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Use os botões "Enviar ao Omie" na ficha do contato ou empresa.
                Acompanhe o progresso no Health Center.
              </div>
            </div>
            {integ?.last_sync_at && (
              <div className="text-xs text-muted-foreground">
                Última sincronização: {new Date(integ.last_sync_at).toLocaleString("pt-BR")}
              </div>
            )}
            {integ && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => removeMut.mutate()}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remover integração
              </Button>
            )}
          </div>
        )}
      </div>

      <Separator className="my-6" />

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          Voltar
        </Button>
        <div className="flex gap-2">
          {step === 2 && isOmie && (
            <Button
              size="sm"
              onClick={() => saveMut.mutate()}
              disabled={!appKey || !appSecret || saveMut.isPending}
            >
              {saveMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Salvar e avançar
            </Button>
          )}
          {!(step === 2 && isOmie) && step < WIZARD_STEPS.length - 1 && (
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>
              Avançar
            </Button>
          )}
          {step === WIZARD_STEPS.length - 1 && (
            <Button size="sm" onClick={onClose}>Concluir</Button>
          )}
        </div>
      </div>
    </>
  );
}
