import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { saveErpIntegration, testErpConnection } from "@/lib/erp.functions";
import { testBlingConnection, importContactsFromBling } from "@/lib/bling.functions";
import { diagnoseConnectionError } from "@/lib/connect-hub-ai.functions";
import { FRIENDLY_ERPS, translateError, type FriendlyErp } from "@/lib/connect-hub";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, Loader2, Plug,
  Cloud, Database, Shield, FileSpreadsheet, Sparkles, PartyPopper,
  HelpCircle, Lock, MessageCircle, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

const STEP_LABELS = ["Seu ERP", "Como conectar", "Acesso", "Teste", "Dados", "Pronto"];

export const Route = createFileRoute("/_app/integrations/connect")({ component: ConnectWizard });

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type Method = "api" | "db" | "agent" | "csv";

function ConnectWizard() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [erp, setErp] = useState<FriendlyErp | null>(null);
  const [method, setMethod] = useState<Method | null>(null);
  const [form, setForm] = useState({ name: "", app_key: "", app_secret: "" });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [aiHint, setAiHint] = useState<{ summary: string; suggestions: string[] } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ inserted: number; skipped: number } | null>(null);

  const save = useServerFn(saveErpIntegration);
  const testOmie = useServerFn(testErpConnection);
  const testBling = useServerFn(testBlingConnection);
  const importBling = useServerFn(importContactsFromBling);
  const diagnose = useServerFn(diagnoseConnectionError);

  if (!canManage) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Apenas administradores podem conectar ERPs.
        </CardContent></Card>
      </div>
    );
  }

  const provider = erp?.recommended === "api-bling" ? "bling" : erp?.recommended === "api-omie" ? "omie" : "custom";

  async function handleTest() {
    if (!orgId) return;
    setTesting(true);
    setTestResult(null);
    setAiHint(null);
    try {
      // 1) salva credenciais
      await save({
        data: {
          organization_id: orgId,
          provider,
          app_key: form.app_key,
          app_secret: form.app_secret || form.app_key,
          is_active: true,
        },
      });
      // 2) testa
      if (provider === "bling") {
        await testBling({ data: { organization_id: orgId } });
      } else if (provider === "omie") {
        await testOmie({ data: { organization_id: orgId } });
      }
      setTestResult({ ok: true });
      setStep(5);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResult({ ok: false, error: msg });
      // pede ajuda à IA em paralelo
      diagnose({
        data: {
          provider: erp?.name ?? provider,
          connection_type: (method ?? "api") as "api" | "db" | "agent" | "csv",
          error_message: msg,
        },
      })
        .then(setAiHint)
        .catch(() => null);
    } finally {
      setTesting(false);
    }
  }

  async function handleSync() {
    if (!orgId) return;
    setSyncing(true);
    try {
      if (provider === "bling") {
        const r = await importBling({ data: { organization_id: orgId, limit: 100 } });
        setSyncResult({ inserted: r.inserted, skipped: r.skipped });
      } else if (provider === "omie") {
        // Omie ainda não tem import bulk pronto — usuário usa a aba avançada.
        // Aqui sinalizamos sucesso parcial.
        setSyncResult({ inserted: 0, skipped: 0 });
        toast.info("Conexão pronta! Use Configurações avançadas para sincronizar lotes do Omie.");
      } else {
        setSyncResult({ inserted: 0, skipped: 0 });
      }
      setStep(6);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link to="/integrations">
        <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
      </Link>

      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Plug className="h-6 w-6" /> Conectar meu ERP
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vamos te guiar passo a passo. Você não precisa entender de tecnologia. 💡
        </p>

        {/* Stepper nomeado */}
        <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
          {STEP_LABELS.map((label, i) => {
            const n = (i + 1) as Step;
            const active = step === n;
            const done = step > n;
            return (
              <div key={label} className="flex items-center gap-1 shrink-0">
                <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs border transition ${
                  active ? "border-primary bg-primary/10 text-primary font-medium" :
                  done ? "border-green-500/40 bg-green-500/5 text-green-700 dark:text-green-400" :
                  "border-muted text-muted-foreground"
                }`}>
                  <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${
                    active ? "bg-primary text-primary-foreground" :
                    done ? "bg-green-600 text-white" :
                    "bg-muted"
                  }`}>
                    {done ? "✓" : i + 1}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && <div className="h-px w-3 bg-border" />}
              </div>
            );
          })}
        </div>
        <Progress value={(step / 6) * 100} className="mt-3 h-1" />
      </div>

      {/* PASSO 1 — Escolher ERP */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Qual é o seu ERP?</CardTitle>
            <CardDescription>Escolha o sistema que você usa hoje.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {FRIENDLY_ERPS.map((e) => (
                <button
                  key={e.id}
                  onClick={() => { setErp(e); setStep(2); }}
                  className={`text-left rounded-lg border p-4 hover:border-primary hover:bg-accent transition ${erp?.id === e.id ? "border-primary bg-accent" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{e.logo}</span>
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {e.name}
                        {e.recommended === "soon" && <Badge variant="secondary" className="text-[10px]">Em breve</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{e.blurb}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground flex items-start gap-2">
              <HelpCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <strong className="text-foreground">Não sabe qual é o seu ERP?</strong> É o sistema que sua empresa usa para
                emitir notas, controlar estoque ou financeiro. Se ninguém da equipe souber, escolha
                <em> "ERP personalizado"</em> e nós te ajudamos por planilha.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASSO 2 — Método */}
      {step === 2 && erp && (
        <Card>
          <CardHeader>
            <CardTitle>Como você quer conectar o {erp.name}?</CardTitle>
            <CardDescription>Escolha a forma mais fácil para você.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <MethodCard
              icon={<Cloud className="h-5 w-5" />}
              title="Tenho dados de API"
              desc="Recomendado quando seu ERP fornece chave de acesso."
              recommended={erp.recommended === "api-omie" || erp.recommended === "api-bling"}
              disabled={erp.recommended === "custom" || erp.recommended === "soon"}
              onClick={() => { setMethod("api"); setStep(3); }}
            />
            <MethodCard
              icon={<FileSpreadsheet className="h-5 w-5" />}
              title="Importar por planilha"
              desc="Use para importar dados manualmente em CSV."
              onClick={() => { setMethod("csv"); navigate({ to: "/integrations/advanced" }); }}
            />
            <MethodCard
              icon={<Database className="h-5 w-5" />}
              title="Acesso ao banco de dados"
              desc="PostgreSQL, Firebird, SQL Server ou MySQL."
              soon
              onClick={() => toast.info("Conexão direta com banco em breve. Use API ou planilha por enquanto.")}
            />
            <MethodCard
              icon={<Shield className="h-5 w-5" />}
              title="Agente Local"
              desc="Mais seguro para ERPs instalados no servidor da empresa."
              soon
              onClick={() => toast.info("Agente Local em breve. Use API ou planilha por enquanto.")}
            />
            <div className="sm:col-span-2 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASSO 3 — Formulário */}
      {step === 3 && erp && method === "api" && (
        <Card>
          <CardHeader>
            <CardTitle>Dados de acesso do {erp.name}</CardTitle>
            <CardDescription>Preencha os campos abaixo. Nada disso é compartilhado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Reforço de segurança */}
            <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2 text-xs text-green-700 dark:text-green-400">
              <Lock className="h-4 w-4" />
              Suas credenciais são criptografadas e ficam guardadas apenas na sua conta.
            </div>

            <div className="space-y-2">
              <Label>Nome desta conexão</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={`Meu ${erp.name}`} />
              <p className="text-xs text-muted-foreground">Um apelido para você identificar depois. Ex: "Matriz" ou "Filial SP".</p>
            </div>

            {provider === "bling" ? (
              <div className="space-y-2">
                <Label>Access Token <span className="text-xs text-muted-foreground font-normal">(token de acesso)</span></Label>
                <Input
                  type="password"
                  value={form.app_key}
                  onChange={(e) => setForm({ ...form, app_key: e.target.value })}
                  placeholder="Cole aqui o token do Bling"
                />
                <WhereToFind
                  title="Onde encontro o Access Token do Bling?"
                  steps={[
                    "Acesse seu Bling em bling.com.br e faça login",
                    'Clique no menu "Preferências" (canto superior direito)',
                    'Vá em "Sistema" → "Integrações" → "API"',
                    'Clique em "Gerar novo token" e copie o código',
                    "Cole o código no campo acima",
                  ]}
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>App Key <span className="text-xs text-muted-foreground font-normal">(chave do aplicativo)</span></Label>
                  <Input value={form.app_key} onChange={(e) => setForm({ ...form, app_key: e.target.value })} placeholder="Sua chave do Omie" />
                </div>
                <div className="space-y-2">
                  <Label>App Secret <span className="text-xs text-muted-foreground font-normal">(segredo do aplicativo)</span></Label>
                  <Input
                    type="password"
                    value={form.app_secret}
                    onChange={(e) => setForm({ ...form, app_secret: e.target.value })}
                    placeholder="Senha do aplicativo Omie"
                  />
                </div>
                <WhereToFind
                  title="Onde encontro App Key e App Secret do Omie?"
                  steps={[
                    "Acesse seu Omie em app.omie.com.br e faça login",
                    'No menu, vá em "Aplicativos" → "Meus Aplicativos"',
                    'Crie um novo app (ou abra um existente) com a permissão "Clientes"',
                    'Copie o "App Key" e o "App Secret" mostrados na tela',
                    "Cole os dois nos campos acima",
                  ]}
                />
              </>
            )}

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              {showAdvanced ? "Ocultar" : "Mostrar"} configurações avançadas
            </button>
            {showAdvanced && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                Porta, SSL, timeout e schema são definidos automaticamente. Para ERPs corporativos,
                use a página de configurações avançadas após conectar.
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
              <Button
                onClick={() => setStep(4)}
                disabled={!form.app_key || (provider === "omie" && !form.app_secret)}
              >
                Continuar <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASSO 4 — Testar */}
      {step === 4 && erp && (
        <Card>
          <CardHeader>
            <CardTitle>Vamos testar a conexão</CardTitle>
            <CardDescription>Clique em testar para confirmar que tudo está certo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!testing && !testResult && (
              <Button size="lg" onClick={handleTest} className="w-full">
                Testar conexão
              </Button>
            )}
            {testing && (
              <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Estamos verificando se conseguimos acessar seu ERP...
              </div>
            )}
            {testResult?.ok === false && (
              <div className="space-y-3 rounded-md border border-red-500/30 bg-red-500/5 p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium">Não conseguimos conectar</p>
                    <p className="text-sm text-muted-foreground">
                      {aiHint?.summary ?? translateError(testResult.error ?? "")}
                    </p>
                  </div>
                </div>
                {aiHint && aiHint.suggestions.length > 0 && (
                  <div className="ml-7 space-y-1">
                    <p className="text-xs font-medium flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Sugestões do assistente
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      {aiHint.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setStep(3)}>Revisar dados</Button>
                  <Button size="sm" onClick={handleTest}>Tentar novamente</Button>
                </div>
              </div>
            )}
            <div className="flex justify-start">
              <Button variant="ghost" onClick={() => setStep(3)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASSO 5 — Dados encontrados / Sincronizar */}
      {step === 5 && erp && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Conexão realizada com sucesso
            </CardTitle>
            <CardDescription>O que você quer trazer do seu ERP?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-4 space-y-2 text-sm">
              <p className="font-medium">O CRM vai organizar automaticamente:</p>
              <ul className="text-muted-foreground space-y-1">
                <li>• Clientes do ERP → <strong>Carteira Comercial</strong></li>
                <li>• Representantes → <strong>Representantes</strong></li>
                <li>• Histórico de compras → <strong>Histórico Comercial</strong></li>
                <li>• Interações → <strong>Timeline Comercial</strong></li>
              </ul>
            </div>

            <Button size="lg" onClick={handleSync} disabled={syncing} className="w-full">
              {syncing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sincronizando...</> : "Sincronizar agora"}
            </Button>

            <Button variant="ghost" className="w-full" onClick={() => { setSyncResult({ inserted: 0, skipped: 0 }); setStep(6); }}>
              Pular por enquanto
            </Button>
          </CardContent>
        </Card>
      )}

      {/* PASSO 6 — Resumo final */}
      {step === 6 && erp && syncResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-primary" />
              Tudo pronto!
            </CardTitle>
            <CardDescription>Seu {erp.name} está conectado ao CRM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-md border p-3">
                <div className="text-2xl font-semibold text-green-600">{syncResult.inserted}</div>
                <div className="text-xs text-muted-foreground">Registros novos</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-2xl font-semibold text-muted-foreground">{syncResult.skipped}</div>
                <div className="text-xs text-muted-foreground">Já existiam</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/integrations" className="flex-1">
                <Button variant="outline" className="w-full">Voltar ao painel</Button>
              </Link>
              <Link to="/carteira" className="flex-1">
                <Button className="w-full">Ver Carteira Comercial</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MethodCard({
  icon, title, desc, onClick, recommended, soon, disabled,
}: {
  icon: React.ReactNode; title: string; desc: string; onClick: () => void;
  recommended?: boolean; soon?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left rounded-lg border p-4 transition ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary hover:bg-accent"} ${recommended ? "border-primary/50" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-primary/10 text-primary p-2">{icon}</div>
        <div className="flex-1">
          <div className="font-medium flex items-center gap-2">
            {title}
            {recommended && <Badge className="text-[10px]">Recomendado</Badge>}
            {soon && <Badge variant="secondary" className="text-[10px]">Em breve</Badge>}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{desc}</div>
        </div>
      </div>
    </button>
  );
}
