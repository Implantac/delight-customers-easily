import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Inbox, Flame, Mail, Phone, ExternalLink, Trash2, Sparkles, ArrowRight } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  getLeadsInbox, convertLeadToDeal, discardLead, type LeadInboxItem,
} from "@/lib/leads-inbox.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/leads")({ component: LeadsInboxPage });

const STATUS_LABEL: Record<LeadInboxItem["status"], string> = {
  new: "Novo",
  contacted: "Contatado",
  converted: "Convertido",
  discarded: "Descartado",
};

const STATUS_VARIANT: Record<LeadInboxItem["status"], "default" | "secondary" | "outline"> = {
  new: "default",
  contacted: "secondary",
  converted: "outline",
  discarded: "outline",
};

function LeadsInboxPage() {
  const { orgId } = useCurrentOrg();
  const [status, setStatus] = useState<"all" | "new" | "contacted" | "converted">("new");
  const [convertItem, setConvertItem] = useState<LeadInboxItem | null>(null);

  const call = useServerFn(getLeadsInbox);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["leads-inbox", orgId, status],
    enabled: !!orgId,
    queryFn: () => call({ data: { organization_id: orgId!, status } }),
  });

  const callDiscard = useServerFn(discardLead);
  const discardMut = useMutation({
    mutationFn: (item: LeadInboxItem) =>
      callDiscard({ data: { organization_id: orgId!, item_id: item.id } }),
    onSuccess: () => {
      toast.success("Lead descartado");
      qc.invalidateQueries({ queryKey: ["leads-inbox", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const items = q.data?.items ?? [];
  const summary = q.data?.summary;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        tone="accent"
        title="Caixa de Leads"
        subtitle="Tudo que chegou — formulários, indicações, contatos novos. Aja direto daqui."
        icon={Inbox}
      />

      {q.isLoading || !summary ? (
        <div className="grid gap-3 md:grid-cols-4">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryCard label="Novos" value={summary.new} hot icon={Flame} />
          <SummaryCard label="Contatados" value={summary.contacted} icon={Mail} />
          <SummaryCard label="Convertidos" value={summary.converted} icon={Sparkles} />
          <SummaryCard label="Total no inbox" value={summary.total} icon={Inbox} />
        </div>
      )}

      <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
        <TabsList>
          <TabsTrigger value="new">Novos {summary ? `(${summary.new})` : ""}</TabsTrigger>
          <TabsTrigger value="contacted">Contatados</TabsTrigger>
          <TabsTrigger value="converted">Convertidos</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>
      </Tabs>

      {q.isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <Inbox className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">Nada no inbox para esse filtro.</p>
            <Link to="/lead-forms" className="text-xs text-primary mt-2">Configurar formulários →</Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <Card key={it.id} className="transition-colors hover:bg-accent/30">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {it.kind === "form_submission" ? <Flame className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{it.name}</p>
                    <Badge variant={STATUS_VARIANT[it.status]} className="text-[10px]">
                      {STATUS_LABEL[it.status]}
                    </Badge>
                    {it.source && (
                      <Badge variant="outline" className="text-[10px]">{it.source}</Badge>
                    )}
                    {it.form_name && (
                      <span className="text-xs text-muted-foreground">via {it.form_name}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    {it.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{it.email}</span>}
                    {it.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{it.phone}</span>}
                    <span>{new Date(it.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {it.contact_id && (
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/contacts/$id" params={{ id: it.contact_id }}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                  {it.deal_id ? (
                    <Badge variant="secondary" className="text-[10px]">Deal aberto</Badge>
                  ) : (
                    <Button size="sm" onClick={() => setConvertItem(it)}>
                      <ArrowRight className="h-3.5 w-3.5 mr-1" /> Converter
                    </Button>
                  )}
                  {it.kind === "form_submission" && it.status !== "converted" && (
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { if (confirm("Descartar este lead?")) discardMut.mutate(it); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConvertDialog
        item={convertItem}
        onClose={() => setConvertItem(null)}
        onConverted={() => qc.invalidateQueries({ queryKey: ["leads-inbox", orgId] })}
      />
    </div>
  );
}

function SummaryCard({ label, value, hot, icon: Icon }: { label: string; value: number; hot?: boolean; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className={hot ? "border-primary/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function ConvertDialog({
  item, onClose, onConverted,
}: { item: LeadInboxItem | null; onClose: () => void; onConverted: () => void }) {
  const { orgId } = useCurrentOrg();
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("0");
  const callConvert = useServerFn(convertLeadToDeal);

  const mut = useMutation({
    mutationFn: () =>
      callConvert({
        data: {
          organization_id: orgId!,
          item_id: item!.id,
          deal_title: title.trim() || `Oportunidade — ${item!.name}`,
          deal_value: Number(value) || 0,
        },
      }),
    onSuccess: () => {
      toast.success("Oportunidade criada");
      onConverted();
      onClose();
      setTitle(""); setValue("0");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Converter em oportunidade</DialogTitle>
          <DialogDescription>
            {item?.name} {item?.email ? `· ${item.email}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título do negócio</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={item ? `Oportunidade — ${item.name}` : ""}
            />
          </div>
          <div>
            <Label>Valor estimado (R$)</Label>
            <Input type="number" step="100" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            Criar oportunidade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
