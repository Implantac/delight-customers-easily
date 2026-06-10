import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Building2,
  Database,
  MessageSquare,
  Rocket,
  Sparkles,
  UserPlus,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_app/welcome")({
  component: WelcomePage,
});

function WelcomePage() {
  const { user } = useAuth();
  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "por aqui";

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Bem-vindo ao USE PATRIUM
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Oi, {firstName}! Vamos colocar seu CRM no ar.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Em poucos minutos você terá seu time vendendo dentro do USE PATRIUM. Siga os
          próximos passos abaixo — pode pular e voltar quando quiser.
        </p>
      </div>

      <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardContent className="flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Setup guiado em 4 passos</h3>
              <p className="text-sm text-muted-foreground">
                Workspace → conectar ERP → primeiro sync → atalhos. Leva ~5 min.
              </p>
            </div>
          </div>
          <Button asChild size="lg">
            <Link to="/setup-wizard">
              Iniciar setup guiado <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>


      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <OnboardingChecklist />

        <div className="space-y-4">
          <QuickCard
            icon={<UserPlus className="h-4 w-4" />}
            title="Convide o time"
            desc="Membros vêem só o que você liberar."
            to="/settings/organization"
            cta="Convidar"
          />
          <QuickCard
            icon={<Database className="h-4 w-4" />}
            title="Importar contatos"
            desc="Suba um CSV e mapeie campos automaticamente."
            to="/settings/import"
            cta="Importar"
          />
          <QuickCard
            icon={<MessageSquare className="h-4 w-4" />}
            title="Conectar WhatsApp"
            desc="Centralize conversas com clientes."
            to="/whatsapp"
            cta="Conectar"
          />
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Pronto para começar a vender?</h3>
              <p className="text-sm text-muted-foreground">
                Vá para o pipeline e crie seu primeiro negócio.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/dashboard">Ir para o painel</Link>
            </Button>
            <Button asChild>
              <Link to="/pipeline">
                Abrir pipeline <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickCard({
  icon,
  title,
  desc,
  to,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  to: string;
  cta: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
            {icon}
          </span>
          <Building2 className="hidden" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{desc}</p>
        <Button asChild size="sm" variant="outline" className="mt-3 w-full">
          <Link to={to}>
            {cta} <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
