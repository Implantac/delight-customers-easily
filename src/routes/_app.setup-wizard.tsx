import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/org";
import { saveErpIntegration, testErpConnection } from "@/lib/erp.functions";
import { enqueueErpSync } from "@/lib/connect-hub.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// select removed: provider is picked via card grid in step 2
import { Badge } from "@/components/ui/badge";
import {
  Rocket, Building2, Plug, RefreshCw, CheckCircle2, ArrowRight, ArrowLeft, Loader2, Sparkles,
  Eye, EyeOff, AlertCircle, ExternalLink, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/_app/setup-wizard")({
  component: SetupWizardPage,
});

type ProviderKey = "bling" | "omie" | "tiny" | "contaazul";

type ProviderSpec = {
  key: ProviderKey;
  label: string;
  short: string;
  keyLabel: string;
  secretLabel?: string;
  needsSecret: boolean;
  docsUrl: string;
  docsHint: string;
};

const PROVIDERS: ProviderSpec[] = [
  {
    key: "bling",
    label: "Bling v3",
    short: "PMEs · varejo · e-commerce",
    keyLabel: "Access Token (Bearer)",
    needsSecret: false,
    docsUrl: "https://developer.bling.com.br/aplicativos",
    docsHint: "Painel Bling → Preferências → Integrações → API → gerar Access Token.",
  },
  {
    key: "omie",
    label: "Omie",
    short: "PMEs · serviços · indústria",
    keyLabel: "APP KEY",
    secretLabel: "APP SECRET",
    needsSecret: true,
    docsUrl: "https://app.omie.com.br/aplicativos/api",
    docsHint: "Omie → Aplicativos → API → criar credencial (APP KEY + APP SECRET).",
  },
  {
    key: "tiny",
    label: "Tiny ERP v3",
    short: "E-commerce · marketplaces",
    keyLabel: "Access Token (OAuth2)",
    needsSecret: false,
    docsUrl: "https://tiny.com.br/ajuda/integracao-api-v3",
    docsHint: "Tiny → Configurações → API v3 → autorizar app e copiar o token.",
  },
  {
    key: "contaazul",
    label: "Conta Azul",
    short: "Contabilidade · PMEs",
    keyLabel: "Access Token (OAuth2)",
    needsSecret: false,
    docsUrl: "https://developers.contaazul.com/",
    docsHint: "Conta Azul Developers → app OAuth → autorizar e copiar o token.",
  },
];

const STEPS = [
  { n: 1, label: "Workspace",    icon: Building2 },
  { n: 2, label: "Conectar ERP", icon: Plug },
  { n: 3, label: "Primeiro sync", icon: RefreshCw },
  { n: 4, label: "Pronto",       icon: CheckCircle2 },
] as const;


function SetupWizardPage() {
  const navigate = useNavigate();
  const { org, orgId } = useCurrentOrg();
  const storageKey = orgId ? `setup-wizard:${orgId}` : null;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1
  const [orgName, setOrgName] = useState(org?.name ?? "");
  const [savingOrg, setSavingOrg] = useState(false);

  // Step 2 (secrets never persisted)
  const [provider, setProvider] = useState<ProviderKey>("bling");
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // Restore non-sensitive draft once orgId is known
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const s = JSON.parse(raw) as {
        step?: 1 | 2 | 3 | 4;
        orgName?: string;
        provider?: ProviderKey;
        integrationId?: string | null;
      };
      if (s.step) setStep(s.step);
      if (s.orgName) setOrgName(s.orgName);
      if (s.provider) setProvider(s.provider);
      if (s.integrationId) setIntegrationId(s.integrationId);
      setRestored(true);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  // Persist progress (no secrets)
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ step, orgName, provider, integrationId }),
      );
    } catch {
      /* ignore */
    }
  }, [storageKey, step, orgName, provider, integrationId]);


  const spec = PROVIDERS.find((p) => p.key === provider)!;

  const saveFn = useServerFn(saveErpIntegration);
  const testFn = useServerFn(testErpConnection);
  const syncFn = useServerFn(enqueueErpSync);

  const friendlyError = (raw: string): string => {
    const m = raw.toLowerCase();
    if (m.includes("401") || m.includes("unauthor")) return "Credencial recusada pelo ERP (401). Verifique se o token está válido e tem permissão de leitura.";
    if (m.includes("403") || m.includes("forbidden")) return "Acesso negado (403). O token existe mas não tem escopo para clientes/vendas.";
    if (m.includes("404")) return "Endpoint não encontrado (404). Confirme se a API do provedor está habilitada na sua conta.";
    if (m.includes("429")) return "Rate limit atingido (429). Aguarde alguns segundos e tente novamente.";
    if (m.includes("timeout") || m.includes("etimedout")) return "Tempo esgotado conectando ao ERP. Tente novamente; se persistir, o ERP pode estar fora do ar.";
    if (m.includes("network") || m.includes("fetch failed")) return "Falha de rede ao chamar o ERP. Verifique conectividade e tente novamente.";
    if (m.includes("app_key") || m.includes("app_secret")) return raw;
    return raw;
  };

  const saveConn = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Sem organização ativa. Recarregue a página.");
      if (!appKey.trim()) throw new Error(`Informe o ${spec.keyLabel}.`);
      if (spec.needsSecret && !appSecret.trim()) throw new Error(`Informe o ${spec.secretLabel}.`);
      const r = await saveFn({
        data: {
          organization_id: orgId,
          provider: provider as any,
          app_key: appKey.trim(),
          app_secret: spec.needsSecret ? appSecret.trim() : appKey.trim(),
          is_active: true,
        },
      });
      const t = await testFn({ data: { organization_id: orgId } });
      return { id: r.integration.id, latency: (t as any).latency_ms ?? null };
    },
    onSuccess: (r) => {
      setIntegrationId(r.id);
      setTestLatency(r.latency);
      setConnError(null);
      toast.success(`Conexão OK${r.latency != null ? ` · ${r.latency}ms` : ""}`);
      setStep(3);
    },
    onError: (e: any) => {
      const msg = friendlyError(e?.message ?? "Falha desconhecida ao conectar.");
      setConnError(msg);
      toast.error(msg);
    },
  });

  const runSync = useMutation({
    mutationFn: async () => {
      if (!orgId || !integrationId) throw new Error("Faltam dados");
      return syncFn({
        data: {
          organizationId: orgId,
          integrationId,
          resources: ["customers", "sales_reps", "sales_history"] as any,
          direction: "pull",
        },
      });
    },
    onSuccess: () => { toast.success("Sync enfileirado"); setStep(4); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao enfileirar"),
  });

  const saveOrgName = async () => {
    if (!orgId || !orgName.trim() || orgName.trim() === org?.name) { setStep(2); return; }
    setSavingOrg(true);
    const { error } = await supabase
      .from("organizations").update({ name: orgName.trim() }).eq("id", orgId);
    setSavingOrg(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Workspace atualizado");
    setStep(2);
  };

  const canSaveConn =
    appKey.trim().length >= 8 && (!spec.needsSecret || appSecret.trim().length >= 8);

  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        title="Setup guiado"
        subtitle="Quatro passos para colocar seu CRM operando com dados reais do ERP."
        icon={Rocket}
      />

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Passo {step} de {STEPS.length}</span>
          <span>{Math.round(progressPct)}% completo</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Stepper (clickable to go back to any completed step) */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Active = s.n === step;
          const Done = s.n < step;
          const Icon = s.icon;
          const clickable = Done;
          return (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && setStep(s.n as 1 | 2 | 3 | 4)}
                className={[
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border transition-all",
                  Active ? "bg-primary text-primary-foreground border-primary shadow-sm" :
                  Done ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 cursor-pointer" :
                  "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-60",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5" /> {s.n}. {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={[
                    "h-0.5 flex-1 rounded-full transition-colors duration-500",
                    s.n < step ? "bg-emerald-500/40" : "bg-border",
                  ].join(" ")}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Animated step container */}
      <div key={step} className="animate-in fade-in slide-in-from-bottom-2 duration-300">



      {step === 1 && (
        <Card className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Como vamos chamar seu workspace?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              É o nome que aparece para seu time. Pode mudar depois em Configurações.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Nome do workspace</Label>
            <Input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Ex.: Grupo Acme"
              maxLength={120}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>Pular</Button>
            <Button onClick={saveOrgName} disabled={savingOrg || !orgName.trim()}>
              {savingOrg && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Continuar <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6 space-y-5">
          <div>
            <h3 className="text-lg font-semibold">Conecte seu ERP</h3>
            <p className="text-sm text-muted-foreground mt-1">
              O CRM importa apenas dados <strong>comerciais</strong> (clientes, vendedores, histórico).
              Nada de estoque, fiscal ou financeiro.
            </p>
          </div>

          {/* Provider catalog as selectable cards */}
          <div className="grid sm:grid-cols-2 gap-2">
            {PROVIDERS.map((p) => {
              const active = p.key === provider;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => { setProvider(p.key); setConnError(null); }}
                  className={[
                    "text-left rounded-lg border p-3 transition-all",
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/40",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{p.label}</span>
                    {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.short}</p>
                </button>
              );
            })}
          </div>

          {/* Where to get token */}
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle className="text-sm">Onde obter as credenciais</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              {spec.docsHint}{" "}
              <a
                href={spec.docsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 underline text-primary"
              >
                Abrir documentação <ExternalLink className="h-3 w-3" />
              </a>
            </AlertDescription>
          </Alert>

          {/* Credential fields */}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>{spec.keyLabel}</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  value={appKey}
                  onChange={(e) => { setAppKey(e.target.value); setConnError(null); }}
                  placeholder="cole aqui"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? "Ocultar" : "Mostrar"}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {spec.needsSecret && (
              <div>
                <Label>{spec.secretLabel}</Label>
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    autoComplete="off"
                    value={appSecret}
                    onChange={(e) => { setAppSecret(e.target.value); setConnError(null); }}
                    placeholder="cole aqui"
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showSecret ? "Ocultar" : "Mostrar"}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Inline error */}
          {connError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Não foi possível conectar</AlertTitle>
              <AlertDescription className="text-xs">
                {connError}
                <div className="mt-2 text-muted-foreground">
                  Dica: confira se o token foi copiado inteiro (sem espaços) e se o app está
                  autorizado a ler clientes e pedidos no painel do {spec.label}.
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Success indicator if already tested */}
          {integrationId && !connError && (
            <Alert className="border-emerald-500/30 bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="text-emerald-700 dark:text-emerald-400">Conexão validada</AlertTitle>
              <AlertDescription className="text-xs">
                Resposta em {testLatency ?? "—"}ms. Pode avançar para o primeiro sync.
              </AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground">
            Precisa de outro provedor (Sankhya, Protheus, SAP B1, Senior, banco direto)?{" "}
            <Link to="/integrations/connect" className="underline">Abra o Connect Hub</Link>.
          </p>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            <div className="flex gap-2">
              {integrationId && (
                <Button variant="outline" onClick={() => setStep(3)}>
                  Avançar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              <Button
                onClick={() => saveConn.mutate()}
                disabled={!canSaveConn || saveConn.isPending}
              >
                {saveConn.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {integrationId ? "Testar novamente" : "Salvar e testar"}
                {!saveConn.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </div>
        </Card>
      )}


      {step === 3 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
            </Badge>
            {testLatency != null && (
              <span className="text-xs text-muted-foreground">Latência {testLatency}ms</span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold">Trazer a primeira leva de dados</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Vamos enfileirar a importação de <strong>clientes</strong>, <strong>vendedores</strong> e
              <strong> histórico de vendas</strong>. Roda em background; você pode acompanhar em
              <Link to="/integrations/health" className="underline ml-1">Saúde das Integrações</Link>.
            </p>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            <Button onClick={() => runSync.mutate()} disabled={runSync.isPending}>
              {runSync.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <RefreshCw className="h-4 w-4 mr-2" /> Iniciar primeiro sync
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Tudo pronto, {orgName || "vamos lá"}!</h3>
              <p className="text-sm text-muted-foreground">
                Em alguns minutos seus dados estarão no CRM. Enquanto isso, dê uma olhada por aqui:
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <ShortcutCard to="/dashboard" title="Dashboard" desc="KPIs comerciais consolidados." />
            <ShortcutCard to="/pipeline" title="Pipeline" desc="Crie sua primeira oportunidade." />
            <ShortcutCard to="/ia-comercial" title="IA Comercial" desc="Lead scoring, churn e recompra." />
            <ShortcutCard to="/integrations/health" title="Saúde das Integrações" desc="Acompanhe o sync." />
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => navigate({ to: "/dashboard" })}>
              Ir para o dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}
      </div>
    </div>
  );
}


function ShortcutCard({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to} className="block">
      <Card className="p-4 hover:border-primary/40 transition-colors">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-1">{desc}</div>
      </Card>
    </Link>
  );
}
