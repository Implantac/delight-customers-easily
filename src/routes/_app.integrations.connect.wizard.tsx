import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { suggestErpProvider } from "@/lib/connect-hub-ai-suggest.functions";
import { FRIENDLY_ERPS } from "@/lib/connect-hub";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Wand2,
  Plug,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  Database,
  GitMerge,
  Stethoscope,
  Rocket,
} from "lucide-react";

export const Route = createFileRoute("/_app/integrations/connect/wizard")({
  component: ConnectWizard,
});

type Step = 1 | 2 | 3 | 4;

function ConnectWizard() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [description, setDescription] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{
    provider: string;
    confidence: number;
    reason: string;
  } | null>(null);

  const suggest = useServerFn(suggestErpProvider);
  const suggestMut = useMutation({
    mutationFn: () => suggest({ data: { description } }),
    onSuccess: (data: any) => {
      const top = data?.suggestions?.[0] ?? data?.top;
      if (top?.provider) {
        setAiResult({
          provider: top.provider,
          confidence: top.confidence ?? 0,
          reason: top.reason ?? "",
        });
        setSelectedProvider(top.provider);
      } else {
        toast.info("IA não identificou um ERP específico. Escolha manualmente.");
      }
    },
    onError: (e: any) =>
      toast.error("IA indisponível", { description: e?.message }),
  });

  if (!canManage) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Sem acesso ao wizard.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <PageHeader
        icon={Plug}
        title="Conectar meu ERP"
        subtitle="Em 4 passos simples, sem precisar de conhecimento técnico."
        action={
          <div className="flex items-center gap-2">
            <Link to="/integrations/help">
              <Button variant="ghost" size="sm" className="gap-2">
                Preciso de ajuda
              </Button>
            </Link>
            <Link to="/integrations">
              <Button variant="ghost" size="sm">
                ← Voltar
              </Button>
            </Link>
          </div>
        }
      />


      {/* Stepper */}
      <div className="flex items-center justify-between">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex-1 flex items-center">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${
                step >= (n as Step)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > (n as Step) ? <CheckCircle2 className="h-4 w-4" /> : n}
            </div>
            {n < 4 && (
              <div
                className={`h-0.5 flex-1 ${
                  step > (n as Step) ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Descrição + IA */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Passo 1 — Descreva
              seu ERP
            </CardTitle>
            <CardDescription>
              Conte em poucas palavras qual ERP você usa. A IA sugere o
              conector ideal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="text-xs">Descrição livre</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: uso Omie na nuvem, com módulo de vendas"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => suggestMut.mutate()}
                disabled={description.length < 3 || suggestMut.isPending}
                className="gap-2"
              >
                {suggestMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Sugerir com IA
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="gap-2"
              >
                Pular <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {aiResult && (
              <Card className="border-primary/30 bg-primary/5 mt-4">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{aiResult.provider}</span>
                    <Badge variant="outline">
                      {Math.round(aiResult.confidence * 100)}%
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {aiResult.reason}
                  </p>
                  <Button size="sm" onClick={() => setStep(2)} className="gap-2">
                    Continuar com {aiResult.provider}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Selecionar ERP */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Passo 2 — Confirme o ERP
            </CardTitle>
            <CardDescription>Escolha o conector que melhor se aplica.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {FRIENDLY_ERPS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProvider(p.id)}
                  className={`text-left flex items-start gap-3 rounded-md border p-3 transition-colors ${
                    selectedProvider === p.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-accent"
                  }`}
                >
                  <span className="text-2xl">{p.logo}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{p.name}</div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {p.blurb}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <Footer
              onBack={() => setStep(1)}
              onNext={() => selectedProvider && setStep(3)}
              nextDisabled={!selectedProvider}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Credenciais — encaminha à tela existente */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Passo 3 — Credenciais
            </CardTitle>
            <CardDescription>
              Você será redirecionado para a tela completa de conexão
              configurada para <strong>{selectedProvider}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border bg-muted/50 p-4 space-y-2">
              <p className="text-sm">
                Na próxima etapa você informa App Key, App Secret ou token
                conforme o tipo do ERP. Tudo é validado em tempo real antes de
                ativar.
              </p>
            </div>
            <Footer
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
              nextLabel="Avançar"
            />
          </CardContent>
        </Card>
      )}

      {/* Step 4: Checklist Go-Live */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4 text-emerald-600" /> Passo 4 — Go-Live
            </CardTitle>
            <CardDescription>
              Sua conexão com <strong>{selectedProvider ?? "ERP"}</strong> está pronta
              para começar a sincronizar. Confirme em 3 verificações rápidas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <GoLiveItem
              icon={Database}
              title="Detectar tabelas e campos"
              desc="Verifica quais tabelas o conector enxerga (clientes, vendas, representantes)."
              to="/integrations/diagnostic"
              cta="Rodar diagnóstico"
            />
            <GoLiveItem
              icon={GitMerge}
              title="Mapear campos do ERP para o CRM"
              desc="Auto-sugestão por nome (cliente_id → external_id, razao_social → name, etc.)."
              to="/integrations/mapping"
              cta="Abrir mapeamento"
            />
            <GoLiveItem
              icon={Stethoscope}
              title="Smoke test (validação final)"
              desc="Importa uma amostra de 10 registros e verifica integridade antes do go-live."
              to="/integrations/smoke-test"
              cta="Rodar smoke test"
            />

            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-xs">
                Quando o smoke test passar, ative a conexão em{" "}
                <Link to="/integrations/dashboard" className="underline font-medium">
                  Connect Hub → Dashboard
                </Link>
                . A primeira sincronização roda automaticamente e você acompanha pelo painel.
              </div>
            </div>

            <Footer
              onBack={() => setStep(3)}
              onNext={() => navigate({ to: "/integrations/dashboard" })}
              nextLabel="Ir para o Connect Hub"
            />
          </CardContent>
        </Card>
      )}

    </div>
  );
}

function Footer({
  onBack,
  onNext,
  nextLabel = "Próximo",
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex justify-between mt-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>
      <Button onClick={onNext} disabled={nextDisabled} className="gap-2">
        {nextLabel} <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
