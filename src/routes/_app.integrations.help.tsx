import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/_app/integrations/help")({ component: HelpPage });

function HelpPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link to="/integrations">
        <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
      </Link>

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

            <AccordionItem value="agente">
              <AccordionTrigger>O que é o Agente Local?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                É um programa pequeno que você instala no servidor da sua empresa.
                Ele lê os dados do ERP e envia para o CRM com segurança, sem precisar abrir
                portas do firewall nem expor seu banco de dados na internet.
                Recomendado para ERPs instalados localmente (TOTVS, Sankhya, Senior).
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
