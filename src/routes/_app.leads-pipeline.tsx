import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Flame, Mail, Phone, ExternalLink, Trash2, Sparkles, GripVertical, Inbox, LayoutList,
  Calendar, Tag, FileText,
} from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  getLeadsInbox, convertLeadToDeal, discardLead, markLeadContacted,
  type LeadInboxItem,
} from "@/lib/leads-inbox.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/leads-pipeline")({
  component: LeadsPipelinePage,
});

type Status = LeadInboxItem["status"];

const COLUMNS: { key: Status; title: string; tone: string; icon: any }[] = [
  { key: "new",        title: "Novos",       tone: "border-primary/40",            icon: Flame },
  { key: "contacted",  title: "Contatados",  tone: "border-blue-500/40",           icon: Mail },
  { key: "converted",  title: "Convertidos", tone: "border-emerald-500/40",        icon: Sparkles },
  { key: "discarded",  title: "Descartados", tone: "border-muted",                 icon: Trash2 },
];

function LeadsPipelinePage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const call = useServerFn(getLeadsInbox);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);
  const [convertItem, setConvertItem] = useState<LeadInboxItem | null>(null);
  const [detailItem, setDetailItem] = useState<LeadInboxItem | null>(null);
  // Sobreposição local de status (otimista). Persistência real apenas para
  // ações suportadas (contatado / convertido / descartado).
  const [localStatus, setLocalStatus] = useState<Record<string, Status>>({});

  const q = useQuery({
    queryKey: ["leads-inbox", orgId, "all"],
    enabled: !!orgId,
    queryFn: () => call({ data: { organization_id: orgId!, status: "all", limit: 500 } }),
  });

  const callContact = useServerFn(markLeadContacted);
  const contactMut = useMutation({
    mutationFn: (id: string) => callContact({ data: { organization_id: orgId!, item_id: id } }),
    onSuccess: () => {
      toast.success("Lead marcado como contatado");
      qc.invalidateQueries({ queryKey: ["leads-inbox", orgId] });
    },
    onError: (e: any, _id) => {
      toast.error(e.message);
      setLocalStatus((s) => { const c = { ...s }; delete c[_id as any]; return c; });
    },
  });

  const callDiscard = useServerFn(discardLead);
  const discardMut = useMutation({
    mutationFn: (id: string) => callDiscard({ data: { organization_id: orgId!, item_id: id } }),
    onSuccess: () => {
      toast.success("Lead descartado");
      qc.invalidateQueries({ queryKey: ["leads-inbox", orgId] });
    },
    onError: (e: any, _id) => {
      toast.error(e.message);
      setLocalStatus((s) => { const c = { ...s }; delete c[_id as any]; return c; });
    },
  });

  const items = q.data?.items ?? [];

  const byStatus = useMemo(() => {
    const map: Record<Status, LeadInboxItem[]> = { new: [], contacted: [], converted: [], discarded: [] };
    for (const it of items) {
      const status = localStatus[it.id] ?? it.status;
      map[status].push(it);
    }
    return map;
  }, [items, localStatus]);

  function handleDrop(toStatus: Status) {
    if (!dragId) return;
    const item = items.find((i) => i.id === dragId);
    setDragId(null);
    setOverCol(null);
    if (!item) return;
    const currentStatus = localStatus[item.id] ?? item.status;
    if (currentStatus === toStatus) return;

    if (toStatus === "converted") {
      if (item.deal_id) { toast.info("Já existe um deal para este lead"); return; }
      setConvertItem(item);
      return;
    }
    if (toStatus === "discarded") {
      if (item.kind !== "form_submission") {
        toast.error("Apenas leads de formulário podem ser descartados.");
        return;
      }
      setLocalStatus((s) => ({ ...s, [item.id]: "discarded" }));
      discardMut.mutate(item.id);
      return;
    }
    if (toStatus === "contacted") {
      setLocalStatus((s) => ({ ...s, [item.id]: "contacted" }));
      contactMut.mutate(item.id);
      return;
    }
    if (toStatus === "new") {
      // Sem reversão persistida — só visual local
      setLocalStatus((s) => ({ ...s, [item.id]: "new" }));
      toast.info("Movido para Novo (apenas visual)");
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        tone="accent"
        title="Pipeline de Leads"
        subtitle="Arraste leads entre as etapas para avançar no funil."
        icon={LayoutList}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/leads"><Inbox className="h-4 w-4 mr-2" /> Ver lista</Link>
          </Button>
        }
      />

      {q.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-[60vh]" />)}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const list = byStatus[col.key];
            const Icon = col.icon;
            const isOver = overCol === col.key;
            return (
              <div
                key={col.key}
                onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
                onDragLeave={() => setOverCol((c) => c === col.key ? null : c)}
                onDrop={(e) => { e.preventDefault(); handleDrop(col.key); }}
                className={`rounded-xl border-2 bg-card/40 ${col.tone} ${isOver ? "ring-2 ring-primary/60 bg-accent/30" : ""} transition-colors`}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{col.title}</span>
                  </div>
                  <Badge variant="secondary" className="tabular-nums">{list.length}</Badge>
                </div>
                <div className="p-2 space-y-2 min-h-[40vh] max-h-[70vh] overflow-y-auto">
                  {list.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Arraste um lead para cá
                    </p>
                  ) : list.map((it) => (
                    <LeadCard
                      key={it.id}
                      item={it}
                      isDragging={dragId === it.id}
                      onDragStart={() => setDragId(it.id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      onClick={() => setDetailItem(it)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConvertDialog
        item={convertItem}
        onClose={() => setConvertItem(null)}
        onConverted={() => {
          if (convertItem) setLocalStatus((s) => ({ ...s, [convertItem.id]: "converted" }));
          qc.invalidateQueries({ queryKey: ["leads-inbox", orgId] });
        }}
      />

      <LeadDetailsDrawer
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onConvert={(it: LeadInboxItem) => { setDetailItem(null); setConvertItem(it); }}
        onContact={(it: LeadInboxItem) => {
          setLocalStatus((s) => ({ ...s, [it.id]: "contacted" }));
          contactMut.mutate(it.id);
          setDetailItem(null);
        }}
        onDiscard={(it: LeadInboxItem) => {
          if (it.kind !== "form_submission") {
            toast.error("Apenas leads de formulário podem ser descartados.");
            return;
          }
          setLocalStatus((s) => ({ ...s, [it.id]: "discarded" }));
          discardMut.mutate(it.id);
          setDetailItem(null);
        }}
      />
    </div>
  );
}

function LeadCard({
  item, isDragging, onDragStart, onDragEnd, onClick,
}: {
  item: LeadInboxItem;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`cursor-grab active:cursor-grabbing transition ${isDragging ? "opacity-50 ring-2 ring-primary" : "hover:bg-accent/40"}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate">{item.name}</p>
              {item.source && (
                <Badge variant="outline" className="text-[10px]">{item.source}</Badge>
              )}
            </div>
            {item.form_name && (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">via {item.form_name}</p>
            )}
            <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
              {item.email && (
                <div className="flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{item.email}</div>
              )}
              {item.phone && (
                <div className="flex items-center gap-1 truncate"><Phone className="h-3 w-3 shrink-0" />{item.phone}</div>
              )}
              <div>{new Date(item.created_at).toLocaleDateString("pt-BR")}</div>
            </div>
            {item.contact_id && (
              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                <Button asChild size="sm" variant="ghost" className="h-6 px-2 text-[11px]">
                  <Link to="/contacts/$id" params={{ id: item.contact_id }}>
                    <ExternalLink className="h-3 w-3 mr-1" /> Abrir contato
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
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

function statusLabel(s: Status) {
  return s === "new" ? "Novo" : s === "contacted" ? "Contatado" : s === "converted" ? "Convertido" : "Descartado";
}

function LeadDetailsDrawer({
  item, onClose, onConvert, onContact, onDiscard,
}: {
  item: LeadInboxItem | null;
  onClose: () => void;
  onConvert: (it: LeadInboxItem) => void;
  onContact: (it: LeadInboxItem) => void;
  onDiscard: (it: LeadInboxItem) => void;
}) {
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" />
                {item.name}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{statusLabel(item.status)}</Badge>
                {item.source && <Badge variant="outline">{item.source}</Badge>}
                {item.form_name && (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <FileText className="h-3 w-3" /> {item.form_name}
                  </span>
                )}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <section className="space-y-2 text-sm">
                {item.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${item.email}`} className="hover:underline truncate">{item.email}</a>
                  </div>
                )}
                {item.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${item.phone}`} className="hover:underline">{item.phone}</a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Criado em {new Date(item.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="h-4 w-4" />
                  <span className="text-xs">
                    Tipo: {item.kind === "form_submission" ? "Submissão de formulário" : "Contato"}
                  </span>
                </div>
              </section>

              {item.payload && Object.keys(item.payload).length > 0 && (
                <>
                  <Separator />
                  <section>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                      Dados do formulário
                    </p>
                    <dl className="space-y-1.5 text-sm">
                      {Object.entries(item.payload).map(([k, v]) => (
                        <div key={k} className="grid grid-cols-3 gap-2">
                          <dt className="text-muted-foreground truncate">{k}</dt>
                          <dd className="col-span-2 break-words">{String(v ?? "—")}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </>
              )}

              {item.contact_id && (
                <>
                  <Separator />
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to="/contacts/$id" params={{ id: item.contact_id }}>
                      <ExternalLink className="h-4 w-4 mr-2" /> Abrir contato completo
                    </Link>
                  </Button>
                </>
              )}
            </div>

            <SheetFooter className="mt-6 flex flex-col gap-2 sm:flex-col sm:space-x-0">
              {item.status !== "contacted" && item.status !== "converted" && (
                <Button variant="outline" onClick={() => onContact(item)}>
                  <Mail className="h-4 w-4 mr-2" /> Marcar como contatado
                </Button>
              )}
              {item.status !== "converted" && !item.deal_id && (
                <Button onClick={() => onConvert(item)}>
                  <Sparkles className="h-4 w-4 mr-2" /> Converter em oportunidade
                </Button>
              )}
              {item.kind === "form_submission" && item.status !== "discarded" && (
                <Button variant="destructive" onClick={() => onDiscard(item)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Descartar
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
