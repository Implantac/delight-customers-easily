import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { Timeline, type TimelineItem } from "@/components/timeline";
import { ArrowLeft, Mail, Phone, Briefcase, Trash2, Building2, KanbanSquare, Clock, MessageCircle, History as HistoryIcon } from "lucide-react";
import { AuditHistory } from "@/components/audit-history";
import { SendEmailDialog } from "@/components/send-email-dialog";
import { AIInsights } from "@/components/ai-insights";
import { Attachments } from "@/components/attachments";
import { TagPicker } from "@/components/tag-picker";
import { whatsappLink } from "@/lib/wa";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/contacts/$id")({ component: ContactDetail });

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

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts"] }); toast.success("Removido"); navigate({ to: "/contacts" }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-4 md:p-8 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full max-w-2xl" /></div>;
  if (!contact) return <div className="p-4 md:p-8"><p className="text-muted-foreground">Contato não encontrado.</p></div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="mb-4"><Link to="/contacts"><ArrowLeft className="mr-1 h-4 w-4" />Contatos</Link></Button>
      <PageHeader
        title={contact.name}
        subtitle={contact.position ?? undefined}
        action={
          <div className="flex flex-wrap gap-2">
            {contact.phone && whatsappLink(contact.phone) && (
              <Button variant="outline" size="sm" asChild>
                <a href={whatsappLink(contact.phone)!} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</a>
              </Button>
            )}
            {contact.email && <SendEmailDialog to={contact.email} contactId={contact.id} />}
            <Button variant="outline" size="sm" onClick={() => { if (confirm("Remover contato?")) del.mutate(); }}><Trash2 className="mr-1 h-4 w-4" />Remover</Button>
          </div>
        }
      />

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <Card className="p-5 md:col-span-1">
          <h3 className="text-sm font-semibold">Detalhes</h3>
          <dl className="mt-3 space-y-2 text-sm">
            {contact.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a></div>}
            {contact.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{contact.phone}</div>}
            {contact.position && <div className="flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 text-muted-foreground" />{contact.position}</div>}
            {contact.companies && (
              <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <Link to="/companies/$id" params={{ id: (contact.companies as any).id }} className="text-primary hover:underline">{(contact.companies as any).name}</Link>
              </div>
            )}
          </dl>
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Etiquetas</p>
            <TagPicker entityType="contact" entityId={contact.id} />
          </div>
          {contact.notes && <><h3 className="mt-5 text-sm font-semibold">Notas</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{contact.notes}</p></>}
        </Card>

        <div className="space-y-6 md:col-span-2">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><KanbanSquare className="h-4 w-4" />Negócios ({deals?.length ?? 0})</h3>
            <div className="mt-3 space-y-2">
              {(deals ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum negócio vinculado.</p>}
              {deals?.map((d) => (
                <Link key={d.id} to="/pipeline" className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent">
                  <span className="font-medium">{d.title}</span>
                  <div className="flex items-center gap-2"><Badge variant="secondary">{d.stage}</Badge><span className="text-muted-foreground">{Number(d.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</span></div>
                </Link>
              ))}
            </div>
          </Card>

          <Attachments entityType="contact" entityId={contact.id} />

          <AIInsights contactId={contact.id} actions={["summarize_contact", "next_action"]} />

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4" />Timeline</h3>
            <div className="mt-4">
              <Timeline
                emptyLabel="Sem atividades por aqui ainda."
                items={[
                  ...(activities ?? []).map<TimelineItem>((a) => ({
                    id: a.id, kind: "activity", type: a.type, title: a.title, completed: a.completed,
                    date: a.due_date ?? new Date().toISOString(),
                    meta: a.type + (a.due_date ? ` · ${new Date(a.due_date).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""),
                  })),
                ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
              />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-4"><HistoryIcon className="h-4 w-4" />Histórico de alterações</h3>
            <AuditHistory entityType="contacts" entityId={contact.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}
