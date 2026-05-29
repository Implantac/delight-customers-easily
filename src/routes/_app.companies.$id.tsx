import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { HealthScore } from "@/components/health-score";
import { Timeline, type TimelineItem } from "@/components/timeline";
import { ArrowLeft, Globe, Trash2, Users, KanbanSquare, Clock, History as HistoryIcon } from "lucide-react";
import { Attachments } from "@/components/attachments";
import { TagPicker } from "@/components/tag-picker";
import { AuditHistory } from "@/components/audit-history";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/companies/$id")({ component: CompanyDetail });

function CompanyDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", id],
    queryFn: async () => (await supabase.from("companies").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: contacts } = useQuery({
    queryKey: ["company-contacts", id],
    queryFn: async () => (await supabase.from("contacts").select("id, name, position, email").eq("company_id", id)).data ?? [],
  });
  const { data: deals } = useQuery({
    queryKey: ["company-deals", id],
    queryFn: async () => (await supabase.from("deals").select("id, title, value, stage").eq("company_id", id)).data ?? [],
  });
  const { data: activities } = useQuery({
    queryKey: ["company-activities", id],
    queryFn: async () => {
      const { data: ds } = await supabase.from("deals").select("id").eq("company_id", id);
      const dealIds = (ds ?? []).map((d) => d.id);
      if (dealIds.length === 0) return [];
      const { data } = await supabase.from("activities").select("id, title, type, due_date, completed").in("deal_id", dealIds).order("due_date", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["companies"] }); toast.success("Removida"); navigate({ to: "/companies" }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-4 md:p-8 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full max-w-2xl" /></div>;
  if (!company) return <div className="p-4 md:p-8"><p className="text-muted-foreground">Empresa não encontrada.</p></div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="mb-4"><Link to="/companies"><ArrowLeft className="mr-1 h-4 w-4" />Empresas</Link></Button>
      <PageHeader
        title={company.name}
        subtitle={[company.industry, company.size].filter(Boolean).join(" · ") || undefined}
        action={<Button variant="outline" size="sm" onClick={() => { if (confirm("Remover empresa?")) del.mutate(); }}><Trash2 className="mr-1 h-4 w-4" />Remover</Button>}
      />

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <Card className="p-5 md:col-span-1">
          <h3 className="text-sm font-semibold">Detalhes</h3>
          <dl className="mt-3 space-y-2 text-sm">
            {company.website && <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-muted-foreground" /><a href={company.website} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{company.website}</a></div>}
            {company.industry && <div className="text-muted-foreground">Setor: <span className="text-foreground">{company.industry}</span></div>}
            {company.size && <div className="text-muted-foreground">Tamanho: <span className="text-foreground">{company.size}</span></div>}
          </dl>
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Etiquetas</p>
            <TagPicker entityType="company" entityId={company.id} />
          </div>
          {company.notes && <><h3 className="mt-5 text-sm font-semibold">Notas</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{company.notes}</p></>}
        </Card>

        <div className="space-y-6 md:col-span-2">
          <Attachments entityType="company" entityId={company.id} />
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" />Contatos ({contacts?.length ?? 0})</h3>
            <div className="mt-3 space-y-2">
              {(contacts ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem contatos.</p>}
              {contacts?.map((c) => (
                <Link key={c.id} to="/contacts/$id" params={{ id: c.id }} className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent">
                  <div><p className="font-medium">{c.name}</p>{c.position && <p className="text-xs text-muted-foreground">{c.position}</p>}</div>
                  {c.email && <span className="text-xs text-muted-foreground">{c.email}</span>}
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><KanbanSquare className="h-4 w-4" />Negócios ({deals?.length ?? 0})</h3>
            <div className="mt-3 space-y-2">
              {(deals ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem negócios.</p>}
              {deals?.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <span className="font-medium">{d.title}</span>
                  <div className="flex items-center gap-2"><Badge variant="secondary">{d.stage}</Badge><span className="text-muted-foreground">{Number(d.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</span></div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4" />Timeline</h3>
            <div className="mt-4">
              <Timeline
                emptyLabel="Sem atividades vinculadas aos negócios."
                items={(activities ?? []).map<TimelineItem>((a) => ({
                  id: a.id, kind: "activity", type: a.type, title: a.title, completed: a.completed,
                  date: a.due_date ?? new Date().toISOString(),
                  meta: a.type + (a.due_date ? ` · ${new Date(a.due_date).toLocaleString("pt-BR", { day: "2-digit", month: "short" })}` : ""),
                })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
              />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-4"><HistoryIcon className="h-4 w-4" />Histórico de alterações</h3>
            <AuditHistory entityType="companies" entityId={company.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}
