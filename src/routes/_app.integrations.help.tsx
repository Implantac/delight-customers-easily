import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, HelpCircle, Shield, Download, BookOpen, Copy, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/lib/org";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/integrations/help")({ component: HelpPage });

function HelpPage() {
  const { orgId } = useCurrentOrg();
  const pairingCode = orgId ? `LVB-${orgId.slice(0, 4).toUpperCase()}-${orgId.slice(-4).toUpperCase()}` : "LVB-XXXX-XXXX";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link to="/integrations">
        <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
      </Link>

      <PageHeader
        icon={HelpCircle}
        title="Central de Ajuda — Integrações"
        subtitle="Tudo o que você precisa para conectar o CRM ao seu ERP com segurança."
      />

      {/* Agente Local */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Conexão segura por Agente Local
          </CardTitle>
          <CardDescription>
            Use esta opção quando o ERP está instalado no servidor da empresa. Assim você não
            precisa abrir portas no firewall ou expor o banco na internet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-background p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Seu código de pareamento</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">{pairingCode}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(pairingCode);
                  toast.success("Código copiado");
                }}
              >
                <Copy className="h-4 w-4 mr-1" /> Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use este código ao instalar o Agente para vincular ao seu workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled className="gap-2">
              <Download className="h-4 w-4" /> Baixar Agente (em breve)
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <a href="#agente" onClick={(e) => {
                e.preventDefault();
                document.getElementById("acc-agente")?.scrollIntoView({ behavior: "smooth" });
              }}>
                <BookOpen className="h-4 w-4" /> Ver instruções
              </a>
            </Button>
          </div>

          <ul className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" /> Funciona com TOTVS, Sankhya, Senior e ERPs em servidor local</li>
            <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" /> Sem expor banco de dados na internet</li>
            <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" /> Sincronização criptografada ponta a ponta</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" /> Manual do ConnectHub
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            <AccordionItem value="api">
              <AccordionTrigger>Como conectar por API?</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>1. Acesse o painel do seu ERP (Omie, Bling, etc).</p>
                <p>2. Vá em Integrações ou Configurações de API.</p>
                <p>3. Gere uma chave de acesso (App Key) e uma senha (App Secret) ou Token.</p>
                <p>4. Copie esses dados e cole no formulário do ConnectHub.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="planilha">
              <AccordionTrigger>Como importar por planilha?</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>1. Exporte seus clientes do ERP em formato CSV.</p>
                <p>2. No ConnectHub, escolha "Quero importar por planilha".</p>
                <p>3. Envie o arquivo. O sistema vai sugerir o mapeamento dos campos.</p>
                <p>4. Confirme e pronto.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="agente" id="acc-agente">
              <AccordionTrigger>O que é o Agente Local?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  É um programa pequeno que você instala no servidor da sua empresa.
                  Ele lê os dados do ERP e envia para o CRM com segurança, sem precisar abrir
                  portas do firewall nem expor seu banco de dados na internet.
                </p>
                <p>Recomendado para ERPs instalados localmente (TOTVS, Sankhya, Senior).</p>
                <p className="font-medium text-foreground">Como instalar:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Baixe o instalador do Agente (em breve nesta página).</li>
                  <li>Instale no servidor onde o ERP roda.</li>
                  <li>Cole o código de pareamento mostrado acima.</li>
                  <li>Pronto — a sincronização começa automaticamente.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="appkey">
              <AccordionTrigger>Onde encontrar a App Key e App Secret?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-1">
                <p><strong>Omie:</strong> Menu Aplicativos → Meus Aplicativos → Criar novo aplicativo.</p>
                <p><strong>Bling:</strong> Preferências → Sistema → Integrações → API.</p>
                <p>Se não encontrar, peça ajuda ao suporte do seu ERP.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="host">
              <AccordionTrigger>O que é "host" ou "endereço do servidor"?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                É o endereço da máquina onde seu ERP está instalado. Pode ser um IP
                (ex: 192.168.0.10) ou um nome (ex: erp.minhaempresa.com.br).
                Seu técnico de TI saberá informar.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="erro">
              <AccordionTrigger>O que fazer quando der erro?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-1">
                <p>O ConnectHub mostra uma explicação em linguagem simples para cada erro.</p>
                <p>Se persistir: confira credenciais, internet e se o ERP está ativo.</p>
                <p>Se ainda não funcionar, use a opção "Importar por planilha" enquanto isso.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="seguranca">
              <AccordionTrigger>É seguro?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Sim. Todas as credenciais ficam guardadas com criptografia e apenas o
                administrador da sua empresa tem acesso. O CRM nunca compartilha seus
                dados com terceiros.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
