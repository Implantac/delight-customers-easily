import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HealthScore } from "@/components/health-score";
import { NextActionBlock } from "@/components/next-action-block";
import { Timeline, type TimelineItem } from "@/components/timeline";
import {
  ArrowLeft, Mail, Phone, Briefcase, Trash2, Building2, KanbanSquare,
  Clock, MessageCircle, History as HistoryIcon, Sparkles, Paperclip, LayoutGrid,
  Zap,
} from "lucide-react";
import { AuditHistory } from "@/components/audit-history";
import { SendEmailDialog } from "@/components/send-email-dialog";
import { AIInsights } from "@/components/ai-insights";
import { Attachments } from "@/components/attachments";
import { TagPicker } from "@/components/tag-picker";
import { QuickActionsDock } from "@/components/quick-actions-dock";
import { whatsappLink } from "@/lib/wa";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { listSequences, enrollContact } from "@/lib/sequences.functions";

export const Route = createFileRoute("/_app/contacts/$id")({ component: ContactDetail });

const BRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function ContactDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts").select("*, companies(id, name)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: deals } = useQuery({
    queryKey: ["contact-deals", id],
    queryFn: async () => (await supabase.from("deals").select("id, title, value, stage").eq("contact_id", id)).data ?? [],
  });

  const { data: activities } = useQuery({
    queryKey: ["contact-activities", id],
    queryFn: async () => (await supabase.from("activities").select("id, title, type, due_date, completed").eq("contact_id", id).order("due_date", { ascending: false, nullsFirst: false })).data ?? [],
  });

  const { data: omni } = useQuery({
    queryKey: ["contact-omni", id],
    queryFn: async () => {
      const [waConvs, emailRcpts, formSubs] = await Promise.all([
        supabase.from("whatsapp_conversations").select("id").eq("contact_id", id),
        supabase.from("email_campaign_recipients")
          .select("id, status, sent_at, opened_at, clicked_at, email_campaigns(name)")
          .eq("contact_id", id).order("sent_at", { ascending: false }).limit(50),
        supabase.from("lead_form_submissions")
          .select("id, created_at, lead_forms(name)")
          .eq("contact_id", id).order("created_at", { ascending: false }).limit(20),
      ]);
      const convIds = (waConvs.data ?? []).map((c: any) => c.id);
      let waMsgs: any[] = [];
      if (convIds.length) {
        const { data } = await supabase.from("whatsapp_messages")
          .select("id, direction, body, status, created_at")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false }).limit(50);
        waMsgs = data ?? [];
      }
      return {
        whatsapp: waMsgs,
        emails: emailRcpts.data ?? [],
        forms: formSubs.data ?? [],
      };
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts"] }); toast.success("Removido"); navigate({ to: "/contacts" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const listSeqFn = useServerFn(listSequences);
  const enrollFn = useServerFn(enrollContact);
  const { data: seqData } = useQuery({
    queryKey: ["sequences-for-enroll", contact?.organization_id],
    enabled: !!contact?.organization_id,
    queryFn: () => listSeqFn({ data: { organization_id: contact!.organization_id! } }),
  });
  const enroll = useMutation({
    mutationFn: (sequence_id: string) =>
      enrollFn({ data: { organization_id: contact!.organization_id!, sequence_id, contact_id: id } }),
    onSuccess: (r: any) => toast.success(`Contato inscrito — ${r?.created ?? 0} atividades criadas`),
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-4 md:p-8 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full max-w-2xl" /></div>;
  if (!contact) return <div className="p-4 md:p-8"><p className="text-muted-foreground">Contato não encontrado.</p></div>;

  // ============ Inteligência derivada ============
  const openDeals = (deals ?? []).filter((d: any) => d.stage !== "won" && d.stage !== "lost");
  const wonDeals = (deals ?? []).filter((d: any) => d.stage === "won");
  const wonRevenue = wonDeals.reduce((s, d: any) => s + Number(d.value ?? 0), 0);
  const openPipeline = openDeals.reduce((s, d: any) => s + Number(d.value ?? 0), 0);
  const lastWa = (omni?.whatsapp ?? [])[0]?.created_at as string | undefined;
  const lastEmail = (omni?.emails ?? [])[0]?.sent_at as string | undefined;
  const lastTouch = [lastWa, lastEmail, ...(activities ?? []).map((a: any) => a.due_date)]
    .filter(Boolean).sort().reverse()[0] as string | undefined;
  const waLink = contact.phone ? whatsappLink(contact.phone) : null;
  const initials = (contact.name ?? "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="page-container max-w-[1600px]">
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2 h-7 text-muted-foreground">
        <Link to="/contacts"><ArrowLeft className="mr-1 h-3.5 w-3.5" />Contatos</Link>
      </Button>

      {/* ============ HERO ============ */}
      <div className="surface-elevated relative overflow-hidden p-5 md:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] ring-1 ring-white/10">
              <span className="font-display text-xl font-semibold tracking-tight">{initials}</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-[1.625rem] font-semibold leading-tight tracking-[-0.025em] md:text-[2rem]">
                {contact.name}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                {contact.position && <span>{contact.position}</span>}
                {contact.companies && (
                  <>
                    {contact.position && <span className="opacity-30">·</span>}
                    <Link to="/companies/$id" params={{ id: (contact.companies as any).id }} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Building2 className="h-3 w-3" />
                      {(contact.companies as any).name}
                    </Link>
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {lastTouch && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    <Clock className="h-2.5 w-2.5" />
                    Último contato {new Date(lastTouch).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                )}
                {openDeals.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    <KanbanSquare className="h-2.5 w-2.5" />
                    {openDeals.length} aberta{openDeals.length === 1 ? "" : "s"}
                  </span>
                )}
                {wonDeals.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    <Sparkles className="h-2.5 w-2.5" />
                    {wonDeals.length} ganho{wonDeals.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:shrink-0">
            {waLink && (
              <Button variant="outline" size="sm" asChild>
                <a href={waLink} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</a>
              </Button>
            )}
            {contact.email && <SendEmailDialog to={contact.email} contactId={contact.id} />}
            {contact.phone && (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${contact.phone}`}><Phone className="mr-1 h-4 w-4" />Ligar</a>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => { if (confirm("Remover contato?")) del.mutate(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ============ KPI strip ============ */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Receita ganha" value={BRL(wonRevenue)} hint={`${wonDeals.length} deal${wonDeals.length === 1 ? "" : "s"}`} />
        <Kpi label="Pipeline aberto" value={BRL(openPipeline)} hint={`${openDeals.length} oportunidade${openDeals.length === 1 ? "" : "s"}`} />
        <Kpi label="Atividades" value={String((activities ?? []).length)} hint={`${(activities ?? []).filter((a: any) => !a.completed).length} pendente(s)`} />
        <Kpi
          label="Último contato"
          value={lastTouch ? new Date(lastTouch).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}
          hint={lastWa ? "via WhatsApp" : lastEmail ? "via e-mail" : "sem registro"}
        />
      </div>

      {/* ============ Layout 2 colunas ============ */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Coluna principal */}
        <div className="min-w-0 space-y-6">
          <NextActionBlock surface="contact" title="Próxima ação sugerida" limit={3} showRegenerate />

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" />Visão geral</TabsTrigger>
              <TabsTrigger value="deals" className="gap-1.5"><KanbanSquare className="h-3.5 w-3.5" />Negócios{deals?.length ? ` · ${deals.length}` : ""}</TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5"><Clock className="h-3.5 w-3.5" />Timeline</TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />IA</TabsTrigger>
              <TabsTrigger value="files" className="gap-1.5"><Paperclip className="h-3.5 w-3.5" />Anexos</TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5"><HistoryIcon className="h-3.5 w-3.5" />Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-6">
              <AIInsights contactId={contact.id} actions={["next_action", "summarize_contact"]} />
              {(deals ?? []).length > 0 && (
                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold"><KanbanSquare className="h-4 w-4" />Negócios recentes</h3>
                    <Button variant="ghost" size="sm" asChild><Link to="/pipeline">Pipeline →</Link></Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(deals ?? []).slice(0, 3).map((d) => (
                      <div key={d.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                        <span className="font-medium truncate">{d.title}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={d.stage === "won" ? "default" : d.stage === "lost" ? "destructive" : "secondary"}>{d.stage}</Badge>
                          <span className="text-muted-foreground tabular-nums">{BRL(Number(d.value))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="deals" className="mt-4">
              <Card className="p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><KanbanSquare className="h-4 w-4" />Negócios ({deals?.length ?? 0})</h3>
                <div className="mt-3 space-y-2">
                  {(deals ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum negócio vinculado.</p>}
                  {deals?.map((d) => (
                    <Link key={d.id} to="/pipeline" className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent">
                      <span className="font-medium truncate">{d.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={d.stage === "won" ? "default" : d.stage === "lost" ? "destructive" : "secondary"}>{d.stage}</Badge>
                        <span className="text-muted-foreground tabular-nums">{BRL(Number(d.value))}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              <Card className="p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4" />Timeline omnichannel</h3>
                <div className="mt-4">
                  <Timeline
                    emptyLabel="Sem atividades por aqui ainda."
                    items={[
                      ...(activities ?? []).map<TimelineItem>((a) => ({
                        id: a.id, kind: "activity", type: a.type, title: a.title, completed: a.completed,
                        date: a.due_date ?? new Date().toISOString(),
                        meta: a.type + (a.due_date ? ` · ${new Date(a.due_date).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""),
                      })),
                      ...(omni?.whatsapp ?? []).map<TimelineItem>((m: any) => ({
                        id: m.id, kind: "whatsapp",
                        title: (m.direction === "outbound" ? "→ " : "← ") + (m.body ?? "").slice(0, 80),
                        date: m.created_at,
                        meta: m.direction === "outbound" ? `Você · ${m.status ?? ""}` : "Cliente",
                      })),
                      ...(omni?.emails ?? []).map<TimelineItem>((e: any) => ({
                        id: e.id, kind: "email",
                        title: `Email: ${e.email_campaigns?.name ?? "campanha"}`,
                        date: e.sent_at ?? new Date().toISOString(),
                        meta: [e.status, e.opened_at && "aberto", e.clicked_at && "clicou"].filter(Boolean).join(" · "),
                      })),
                      ...(omni?.forms ?? []).map<TimelineItem>((f: any) => ({
                        id: f.id, kind: "form",
                        title: `Form: ${f.lead_forms?.name ?? "submissão"}`,
                        date: f.created_at,
                        meta: "Lead capturado",
                      })),
                    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
                  />
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="ai" className="mt-4">
              <AIInsights contactId={contact.id} actions={["summarize_contact", "next_action"]} />
            </TabsContent>

            <TabsContent value="files" className="mt-4">
              <Attachments entityType="contact" entityId={contact.id} />
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card className="p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-4"><HistoryIcon className="h-4 w-4" />Histórico de alterações</h3>
                <AuditHistory entityType="contacts" entityId={contact.id} />
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Coluna direita sticky */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <HealthScore contactId={contact.id} />

          <Card className="p-4">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Detalhes
            </h3>
            <dl className="mt-3 space-y-2 text-[13px]">
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <a href={`mailto:${contact.email}`} className="hover:underline truncate">{contact.email}</a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{contact.phone}</span>
                </div>
              )}
              {contact.position && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{contact.position}</span>
                </div>
              )}
              {contact.companies && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Link to="/companies/$id" params={{ id: (contact.companies as any).id }} className="text-primary hover:underline truncate">
                    {(contact.companies as any).name}
                  </Link>
                </div>
              )}
            </dl>
          </Card>

          <Card className="p-4">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Etiquetas
            </h3>
            <div className="mt-2">
              <TagPicker entityType="contact" entityId={contact.id} />
            </div>
            {contact.notes && (
              <>
                <h3 className="mt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Notas
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                  {contact.notes}
                </p>
              </>
            )}
          </Card>

          {(seqData?.sequences ?? []).filter((s: any) => s.active && s.step_count > 0).length > 0 && (
            <Card className="p-4">
              <h3 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Zap className="h-3 w-3" />
                Inscrever em sequência
              </h3>
              <div className="mt-3 space-y-1.5">
                {(seqData?.sequences ?? [])
                  .filter((s: any) => s.active && s.step_count > 0)
                  .slice(0, 6)
                  .map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-[13px]">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{s.name}</div>
                        <div className="text-[11px] text-muted-foreground">{s.step_count} passo{s.step_count === 1 ? "" : "s"}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0"
                        disabled={enroll.isPending}
                        onClick={() => enroll.mutate(s.id)}
                      >
                        Inscrever
                      </Button>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          <Attachments entityType="contact" entityId={contact.id} />
        </aside>
      </div>

      {contact.organization_id && (
        <QuickActionsDock
          organizationId={contact.organization_id}
          companyId={contact.company_id ?? null}
          contactId={contact.id}
          phone={contact.phone ?? null}
          email={contact.email ?? null}
          name={contact.name}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="kpi-card p-4">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <p
        data-slot="kpi-value"
        className="mt-3 font-display text-[1.5rem] font-semibold leading-none tracking-[-0.025em]"
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}
