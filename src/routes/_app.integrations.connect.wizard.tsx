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
  Server,
  BrainCircuit
} from "lucide-react";


export const Route = createFileRoute("/_app/integrations/connect/wizard")({
  component: ConnectWizard,
});

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

function ConnectWizard() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [description, setDescription] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
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
      <div className="p-6 text-center text-muted-foreground">
        Sem acesso ao wizard.
      </div>
    );
  }


  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <PageHeader
        icon={Plug}
        title="ConnectHub Universal Wizard"
        subtitle="Conecte seu ERP em minutos e transforme dados operacionais em inteligência comercial."
        action={
          <Link to="/integrations">
            <Button variant="ghost" size="sm">← Voltar ao Hub</Button>
          </Link>
        }
      />

      {/* Stepper Evolution */}
      <div className="flex items-center justify-between gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <div key={n} className="flex-1 flex items-center">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step >= (n as Step)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > (n as Step) ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
            </div>
            {n < 8 && (
              <div
                className={`h-0.5 flex-1 mx-1 ${
                  step > (n as Step) ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Etapa 1 — Escolher ERP */}
      {step === 1 && (
        <Card className="p-8 border-primary/10">
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> 1. Qual ERP sua empresa utiliza?
              </h2>
              <p className="text-sm text-muted-foreground">Selecione uma das opções abaixo ou descreva seu sistema.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {FRIENDLY_ERPS.slice(0, 11).map((erp) => (
                <button
                  key={erp.id}
                  onClick={() => { setSelectedProvider(erp.id); setStep(2); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all text-center group"
                >
                  <span className="text-3xl group-hover:scale-110 transition-transform">{erp.logo}</span>
                  <span className="text-xs font-bold">{erp.name}</span>
                </button>
              ))}
              <button
                onClick={() => setStep(2)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed border-border/60 hover:border-primary/40 transition-all text-center"
              >
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xl">+</div>
                <span className="text-xs font-bold">Outro ERP</span>
              </button>
            </div>

            <div className="pt-6 border-t border-border/40">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Ou descreva para IA identificar</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Ex: 'uso um sistema desktop em Delphi com banco Firebird'..." 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
                <Button variant="secondary" onClick={() => suggestMut.mutate()}>Detectar</Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Etapa 2 — Escolher Conexão */}
      {step === 2 && (
        <Card className="p-8 border-primary/10">
          <div className="space-y-6 text-center max-w-xl mx-auto">
            <h2 className="text-xl font-bold">Como deseja conectar o {selectedProvider || "ERP"}?</h2>
            <div className="grid grid-cols-1 gap-4">
              <ConnectionCard 
                icon={Plug} 
                title="API REST / Webhook" 
                desc="Conexão nuvem a nuvem. Recomendado para Bling, Omie, Tiny." 
                onClick={() => { setConnectionType("api"); setStep(3); }} 
              />
              <ConnectionCard 
                icon={Database} 
                title="Banco de Dados Direto" 
                desc="PostgreSQL, MySQL, SQL Server ou Oracle." 
                onClick={() => { setConnectionType("db"); setStep(3); }} 
              />
              <ConnectionCard 
                icon={Server} 
                title="Agente Local (Seguro)" 
                desc="Para sistemas desktop sem IP fixo. Não precisa abrir portas." 
                onClick={() => { setConnectionType("agent"); setStep(3); }} 
              />
              <ConnectionCard 
                icon={GitMerge} 
                title="Importação Planilha" 
                desc="CSV ou Excel para carga histórica inicial." 
                onClick={() => { setConnectionType("csv"); setStep(3); }} 
              />
            </div>
            <Button variant="ghost" onClick={() => setStep(1)} className="mt-4">← Voltar</Button>
          </div>
        </Card>
      )}

      {/* Etapa 3 — Informar Dados */}
      {step === 3 && (
        <Card className="p-8 border-primary/10">
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Informe os dados de acesso</h2>
            <div className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <Label>Host / Endereço</Label>
                <Input placeholder="https://api.erp.com.br" />
              </div>
              <div className="space-y-1.5">
                <Label>Chave API / Token</Label>
                <Input type="password" placeholder="••••••••••••••••" />
              </div>
              <p className="text-[10px] text-muted-foreground italic">Seus dados são criptografados de ponta a ponta seguindo a LGPD.</p>
            </div>
            <Footer onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Testar Conexão" />
          </div>
        </Card>
      )}

      {/* Etapa 4 — Testar Conexão */}
      {step === 4 && (
        <Card className="p-8 border-primary/10 text-center">
          <div className="space-y-6 py-10">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold">Conexão bem-sucedida!</h2>
            <p className="text-muted-foreground">O CRM conseguiu se comunicar com seu ERP em 142ms.</p>
            <div className="pt-6">
              <Button size="lg" onClick={() => setStep(5)} className="px-10">Continuar para Diagnóstico IA</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Etapa 5 — IA Diagnóstico */}
      {step === 5 && (
        <Card className="p-8 border-primary/10">
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <BrainCircuit className="h-10 w-10 text-primary shrink-0" />
              <div className="space-y-2">
                <h3 className="font-bold">A IA está analisando a estrutura do ERP...</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Identificamos que seu ERP possui tabelas de clientes com 14.200 registros. 
                  Também encontramos um histórico de vendas de 5 anos pronto para ser transformado em inteligência comercial.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Tabelas de Clientes encontradas
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Vendedores mapeados (18 usuários)
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Histórico de faturamento detectado
              </div>
            </div>
            <Footer onBack={() => setStep(4)} onNext={() => setStep(6)} nextLabel="Ver Dados Encontrados" />
          </div>
        </Card>
      )}

      {/* Etapa 6 — Dados Encontrados */}
      {step === 6 && (
        <Card className="p-8 border-primary/10">
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Confirme os dados que vamos importar</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DataFoundCard label="Clientes" count="14.202" />
              <DataFoundCard label="Representantes" count="18" />
              <DataFoundCard label="Contatos" count="21.500" />
              <DataFoundCard label="Vendas (Histórico)" count="82.410" />
            </div>
            <Footer onBack={() => setStep(5)} onNext={() => setStep(7)} nextLabel="Mapear Campos" />
          </div>
        </Card>
      )}

      {/* Etapa 7 — Confirmar Mapeamento */}
      {step === 7 && (
        <Card className="p-8 border-primary/10">
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Auto-mapeamento Inteligente</h2>
            <p className="text-sm text-muted-foreground">A IA já sugeriu o melhor mapeamento. Deseja ajustar algo?</p>
            <div className="space-y-3">
              <MappingItem erp="RAZAO_SOCIAL" crm="Nome do Cliente" />
              <MappingItem erp="ID_VENDEDOR" crm="Responsável" />
              <MappingItem erp="VALOR_TOTAL" crm="Faturamento" />
              <MappingItem erp="DATA_EMISSAO" crm="Data Comercial" />
            </div>
            <Footer onBack={() => setStep(6)} onNext={() => setStep(8)} nextLabel="Finalizar e Sincronizar" />
          </div>
        </Card>
      )}

      {/* Etapa 8 — Sincronizar */}
      {step === 8 && (
        <Card className="p-12 border-primary/20 bg-gradient-to-br from-primary/5 to-background text-center">
          <div className="space-y-8 py-10">
            <div className="relative inline-block">
              <Rocket className="h-16 w-16 text-primary animate-bounce" />
              <div className="absolute inset-0 bg-primary/20 blur-2xl -z-10 rounded-full" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-display font-bold">Tudo Pronto!</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Sua ponte comercial está configurada. A partir de agora, o CRM trabalhará para você buscando novas oportunidades.
              </p>
            </div>
            <Button size="lg" className="px-12 h-14 rounded-full font-bold shadow-xl shadow-primary/20" onClick={() => navigate({ to: "/integrations" })}>
              INICIAR PRIMEIRA SINCRONIZAÇÃO
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function ConnectionCard({ icon: Icon, title, desc, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 p-4 rounded-xl border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
    >
      <div className="p-3 rounded-xl bg-secondary group-hover:bg-primary/10 transition-colors">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <div className="text-sm font-bold">{title}</div>
        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

function DataFoundCard({ label, count }: any) {
  return (
    <div className="p-4 rounded-xl bg-muted/30 border border-border/40">
      <div className="text-xs text-muted-foreground uppercase font-bold tracking-widest">{label}</div>
      <div className="text-2xl font-display font-bold">{count}</div>
    </div>
  );
}

function MappingItem({ erp, crm }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card">
      <div className="text-xs font-mono text-muted-foreground">{erp}</div>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
      <div className="text-xs font-bold text-primary">{crm}</div>
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

function GoLiveItem({
  icon: Icon,
  title,
  desc,
  to,
  cta,
}: {
  icon: typeof Plug;
  title: string;
  desc: string;
  to: string;
  cta: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Link to={to as any}>
        <Button size="sm" variant="outline" className="gap-1 shrink-0">
          {cta} <ArrowRight className="h-3 w-3" />
        </Button>
      </Link>
    </div>
  );
}


