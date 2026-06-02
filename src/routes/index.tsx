import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  CheckCircle2,
  LineChart,
  MapPin,
  MessageSquare,
  Quote,
  ShieldCheck,
  Sparkles,
  Target,
  Workflow,
  Zap,
} from "lucide-react";

const SITE_URL = "https://delight-customers-easily.lovable.app";

const FAQ_ITEMS = [
  {
    q: "Preciso de cartão de crédito para começar?",
    a: "Não. O plano Starter é gratuito e você pode criar sua organização em minutos.",
  },
  {
    q: "Funciona para times com poucos vendedores?",
    a: "Sim. O USE CRM foi pensado para escalar de 1 vendedor a operações com dezenas de equipes.",
  },
  {
    q: "Meus dados ficam isolados de outras empresas?",
    a: "Sim. Cada organização é totalmente isolada por padrão, com políticas de segurança em nível de banco de dados.",
  },
  {
    q: "Consigo migrar minha planilha atual?",
    a: "Sim. Suportamos importação por CSV e temos um assistente de mapeamento de campos.",
  },
  {
    q: "A IA usa os meus dados para treinar modelos?",
    a: "Não. Seus dados são usados apenas para gerar sugestões dentro da sua própria organização.",
  },
];

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "CRM comercial com IA para times que vendem mais — USE CRM" },
      {
        name: "description",
        content:
          "Pipeline, automação, WhatsApp, mapa de oportunidades e IA comercial em um só CRM. Centralize contatos, fechamentos e operação do time em minutos.",
      },
      { property: "og:title", content: "CRM comercial com IA para times que vendem mais" },
      {
        property: "og:description",
        content:
          "Pipeline, automação, WhatsApp e IA comercial em um só CRM. Comece grátis.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL + "/" },
      { name: "twitter:title", content: "CRM comercial com IA para times que vendem mais" },
      {
        name: "twitter:description",
        content: "Pipeline, automação, WhatsApp e IA comercial em um só CRM.",
      },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "USE CRM",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: SITE_URL,
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "BRL",
          },
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.8",
            ratingCount: "127",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ_ITEMS.map((it) => ({
            "@type": "Question",
            name: it.q,
            acceptedAnswer: { "@type": "Answer", text: it.a },
          })),
        }),
      },
    ],
  }),
});

function LandingPage() {
  const { user, loading } = useAuth();
  const ctaHref = user ? "/dashboard" : "/login";
  const ctaLabel = user ? "Ir para o app" : "Começar grátis";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader ctaHref={ctaHref} ctaLabel={loading ? "Entrar" : ctaLabel} />
      <main>
        <Hero ctaHref={ctaHref} ctaLabel={loading ? "Entrar" : ctaLabel} />
        <StatsStrip />
        <Features />
        <Workflow_ />
        <AISection />
        <Testimonials />
        <Pricing ctaHref={ctaHref} />
        <FAQ />
        <FinalCTA ctaHref={ctaHref} ctaLabel={loading ? "Entrar" : ctaLabel} />
      </main>
      <SiteFooter />
    </div>
  );
}


/* ---------------- Header ---------------- */

function SiteHeader({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--gradient-accent)] text-[#1f2740] shadow-[var(--shadow-glow)] ring-1 ring-white/15">
            <Sparkles className="h-4 w-4" />
          </span>
          <span>USE CRM</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">Recursos</a>
          <a href="#workflow" className="transition-colors hover:text-foreground">Como funciona</a>
          <a href="#ai" className="transition-colors hover:text-foreground">IA</a>
          <a href="#pricing" className="transition-colors hover:text-foreground">Planos</a>
          <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link to={ctaHref}>
              {ctaLabel}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ---------------- Hero ---------------- */

function Hero({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-20%] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute right-[-10%] top-[10%] h-[400px] w-[600px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent,var(--background)_70%)]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-20 pt-20 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-6 gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span className="text-foreground/80">Novo: agente de IA comercial integrado</span>
          </Badge>
          <h1 className="text-balance font-display text-4xl font-semibold tracking-tight md:text-6xl">
            O CRM que <span className="bg-gradient-to-r from-accent to-[#e8a05a] bg-clip-text text-transparent">trabalha com o seu time</span>, não contra ele.
          </h1>
          <p className="mt-5 text-pretty text-lg text-muted-foreground md:text-xl">
            Centralize contatos, pipeline, WhatsApp, contratos e propostas. Deixe a IA priorizar o próximo lead,
            redigir follow-ups e detectar negócios em risco — antes que escapem.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link to={ctaHref}>
                {ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
              <a href="#features">Ver recursos</a>
            </Button>
          </div>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" /> Setup em minutos
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" /> Sem cartão de crédito
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" /> Multi-usuário
            </li>
          </ul>
        </div>

        {/* Visual mock */}
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="rounded-2xl border border-border/80 bg-card p-2 shadow-2xl shadow-primary/5">
            <div className="rounded-xl border border-border/60 bg-gradient-to-br from-muted/40 via-background to-background p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <MockCard
                  icon={<LineChart className="h-4 w-4" />}
                  label="Pipeline ativo"
                  value="R$ 1.284.500"
                  hint="+18% vs. mês anterior"
                />
                <MockCard
                  icon={<Target className="h-4 w-4" />}
                  label="Taxa de fechamento"
                  value="32%"
                  hint="Meta: 28%"
                  positive
                />
                <MockCard
                  icon={<CalendarCheck className="h-4 w-4" />}
                  label="Atividades hoje"
                  value="47"
                  hint="9 follow-ups priorizados"
                />
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-4">
                {["Prospecção", "Qualificação", "Proposta", "Fechamento"].map((stage, i) => (
                  <div
                    key={stage}
                    className="rounded-lg border border-border/70 bg-card p-4"
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{stage}</span>
                      <span>{[24, 17, 9, 4][i]}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-accent"
                          style={{ width: `${[80, 60, 40, 25][i]}%` }}
                        />
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-accent/70"
                          style={{ width: `${[60, 45, 30, 15][i]}%` }}
                        />
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-accent/40"
                          style={{ width: `${[40, 30, 20, 10][i]}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MockCard({
  icon,
  label,
  value,
  hint,
  positive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-accent/15 text-accent ring-1 ring-accent/20">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 font-display text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div
        className={`mt-1 text-xs ${positive ? "text-success" : "text-muted-foreground"}`}
      >
        {hint}
      </div>
    </div>
  );
}

/* ---------------- Stats strip ---------------- */

function StatsStrip() {
  const stats = [
    { value: "3×", label: "mais follow-ups completados" },
    { value: "27%", label: "aumento na taxa de fechamento" },
    { value: "5h", label: "economizadas por vendedor/semana" },
    { value: "100%", label: "dos dados isolados por organização" },
  ];
  return (
    <section className="border-b border-border/60 bg-muted/30 py-12">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">
          Resultados observados em times que adotaram o USE CRM
        </p>
        <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                {s.value}
              </div>
              <div className="mt-1 text-xs text-muted-foreground md:text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Testimonials ---------------- */

const testimonials = [
  {
    quote:
      "Conseguimos consolidar pipeline, WhatsApp e propostas em uma só ferramenta. Em 6 semanas o ciclo de venda caiu 22%.",
    name: "Ana Carvalho",
    role: "Head de Vendas, Construflex",
  },
  {
    quote:
      "O copiloto de IA virou o ponto de partida do dia dos vendedores. Ninguém mais perde tempo decidindo o que fazer primeiro.",
    name: "Rafael Mendes",
    role: "Diretor Comercial, NorteAg",
  },
  {
    quote:
      "Migrei de três planilhas e um WhatsApp Business numa tarde. O importador de CSV simplesmente funcionou.",
    name: "Juliana Reis",
    role: "Fundadora, Aurora Digital",
  },
];

function Testimonials() {
  return (
    <section className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">Depoimentos</Badge>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Times comerciais que pararam de perder oportunidades
          </h2>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col rounded-2xl border border-border/70 bg-card p-6"
            >
              <Quote className="h-5 w-5 text-primary/70" />
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground/90">
                "{t.quote}"
              </blockquote>
              <figcaption className="mt-6">
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Features ---------------- */

const features = [
  {
    icon: <Workflow className="h-5 w-5" />,
    title: "Pipeline visual",
    desc: "Kanban arrastável com previsão de receita, alertas de risco e métricas por etapa.",
  },
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: "WhatsApp nativo",
    desc: "Converse pelo CRM, mantenha histórico unificado e dispare sequências automáticas.",
  },
  {
    icon: <Bot className="h-5 w-5" />,
    title: "IA Comercial",
    desc: "Sugestões do próximo passo, redação de follow-ups e resumo automático de contas.",
  },
  {
    icon: <MapPin className="h-5 w-5" />,
    title: "Mapa de oportunidades",
    desc: "Visualize cobertura geográfica, rotas e prospecção por território.",
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Forecast e metas",
    desc: "Previsão por vendedor, equipe e produto. Compare com a meta em tempo real.",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Multi-tenant seguro",
    desc: "Cada organização isolada por padrão. Permissões granulares e auditoria.",
  },
];

function Features() {
  return (
    <section id="features" className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">Recursos</Badge>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Tudo o que o seu time comercial precisa, em um lugar só
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            Substitua planilhas, ferramentas soltas e processos manuais por uma operação
            comercial moderna, integrada e mensurável.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border/70 bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent ring-1 ring-accent/20 transition-all group-hover:bg-accent/20">
                {f.icon}
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Workflow ---------------- */

function Workflow_() {
  const steps = [
    {
      n: "01",
      title: "Conecte suas fontes",
      desc: "Importe contatos, integre WhatsApp, e-mail e seu ERP em minutos.",
    },
    {
      n: "02",
      title: "Configure o pipeline",
      desc: "Use templates por segmento ou crie etapas, campos e automações próprias.",
    },
    {
      n: "03",
      title: "Deixe a IA trabalhar",
      desc: "Receba o próximo passo, alertas de risco e relatórios automáticos toda semana.",
    },
  ];
  return (
    <section id="workflow" className="border-b border-border/60 bg-muted/20 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">Como funciona</Badge>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Do cadastro ao fechamento em 3 passos
          </h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="relative rounded-2xl border border-border/70 bg-card p-6">
              <div className="text-xs font-semibold tracking-widest text-primary">{s.n}</div>
              <h3 className="mt-2 text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- AI Section ---------------- */

function AISection() {
  return (
    <section id="ai" className="border-b border-border/60 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-2">
        <div>
          <Badge variant="outline" className="mb-4 gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> IA Comercial
          </Badge>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Um copiloto que conhece cada conta tão bem quanto o seu melhor vendedor
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            A IA analisa histórico de atividades, conversas e dados do negócio para
            sugerir o próximo passo, redigir mensagens no seu tom e antecipar riscos
            no funil.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              "Priorização automática do dia do vendedor",
              "Redação de e-mails e mensagens contextuais",
              "Detecção de deals frios e contas em risco",
              "Resumo executivo de contas em segundos",
            ].map((i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xl shadow-primary/5">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3 text-sm">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </span>
            <span className="font-medium">IA Comercial</span>
            <span className="ml-auto text-xs text-muted-foreground">Agora</span>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-xs font-medium text-muted-foreground">Próximo passo sugerido</p>
              <p className="mt-1">
                Ligar para <span className="font-medium">Mariana (Acme)</span> — proposta enviada há 4 dias sem resposta.
              </p>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <p className="text-xs font-medium text-muted-foreground">Rascunho de e-mail</p>
              <p className="mt-1 leading-relaxed">
                "Oi Mariana, tudo bem? Passando pra entender se faz sentido marcarmos
                15 minutos esta semana pra revisar a proposta. Tenho duas opções
                de escopo que podem encaixar melhor no seu Q1…"
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm">Enviar</Button>
                <Button size="sm" variant="outline">Refinar</Button>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
              <Zap className="h-4 w-4 text-warning" />
              <span><span className="font-medium">Atenção:</span> 3 deals do seu funil estão sem atividade há 14+ dias.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Pricing ---------------- */

function Pricing({ ctaHref }: { ctaHref: string }) {
  const plans = [
    {
      name: "Starter",
      price: "Grátis",
      desc: "Para começar a organizar o time comercial.",
      features: ["Até 3 usuários", "Pipeline e contatos", "Integração WhatsApp básica"],
      cta: "Começar grátis",
      highlight: false,
    },
    {
      name: "Growth",
      price: "R$ 89",
      suffix: "/usuário/mês",
      desc: "Para times em crescimento que querem automação e IA.",
      features: [
        "Tudo do Starter",
        "IA Comercial e sugestões",
        "Automação de sequências",
        "Forecast e relatórios",
      ],
      cta: "Iniciar trial",
      highlight: true,
    },
    {
      name: "Scale",
      price: "Sob consulta",
      desc: "Para operações maiores com múltiplas equipes e ERP.",
      features: [
        "Tudo do Growth",
        "Integrações avançadas e ERP",
        "Permissões granulares",
        "Suporte dedicado",
      ],
      cta: "Falar com vendas",
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="border-b border-border/60 bg-muted/20 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">Planos</Badge>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Preços simples que crescem com você
          </h2>
          <p className="mt-3 text-muted-foreground">
            Comece grátis. Atualize quando o time crescer.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-2xl border bg-card p-6 ${
                p.highlight
                  ? "border-primary/50 shadow-xl shadow-primary/10 ring-1 ring-primary/30"
                  : "border-border/70"
              }`}
            >
              {p.highlight && (
                <Badge className="absolute -top-3 left-6">Mais popular</Badge>
              )}
              <h3 className="text-lg font-semibold tracking-tight">{p.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight">{p.price}</span>
                {p.suffix && (
                  <span className="text-sm text-muted-foreground">{p.suffix}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>

              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className="mt-6"
                variant={p.highlight ? "default" : "outline"}
              >
                <Link to={ctaHref}>{p.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

function FAQ() {
  return (
    <section id="faq" className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center">
          <Badge variant="outline" className="mb-4">Perguntas frequentes</Badge>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Tudo o que você precisa saber
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-10">
          {FAQ_ITEMS.map((it, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{it.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {it.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/* ---------------- Final CTA ---------------- */

function FinalCTA({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-10 text-center md:p-16">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 h-72 w-[600px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
          </div>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Pronto para um CRM que entrega resultado?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
            Comece grátis em minutos. Sem cartão, sem fricção, com suporte humano quando precisar.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link to={ctaHref}>
                {ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
              <a href="#features">Conhecer recursos</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */

function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-12 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 md:flex-row">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="font-medium text-foreground">USE CRM</span>
        </div>
        <p>© {new Date().getFullYear()} USE CRM. Todos os direitos reservados.</p>
        <div className="flex gap-5">
          <Link to="/login" className="hover:text-foreground">Entrar</Link>
          <a href="#pricing" className="hover:text-foreground">Planos</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </div>
      </div>
    </footer>
  );
}
