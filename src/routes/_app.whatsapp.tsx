import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  listWAConversations,
  getWAMessages,
  sendWAMessage,
  simulateIncomingWA,
  createWAConversation,
  updateWAConversation,
  markWARead,
  getWASlaMetrics,
  listOrgMembers,
  listWATemplates,
  type WAConversation,
} from "@/lib/whatsapp.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageCircle, Plus, Send, Check, CheckCheck, Clock, AlertTriangle, MoreVertical, UserPlus, FileText, User, Building2, Phone, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppSlaPanel } from "@/components/whatsapp-sla-panel";
import { NextActionBlock } from "@/components/next-action-block";
import { whatsappLink } from "@/lib/wa";

export const Route = createFileRoute("/_app/whatsapp")({ component: WhatsAppPage });

function initials(n: string) {
  return n.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}
function fmt(s: string) {
  const d = new Date(s);
  const today = new Date();
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
function minsAgo(s: string | null) {
  if (!s) return null;
  return Math.floor((Date.now() - new Date(s).getTime()) / 60000);
}

const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  pending: "Pendente",
  resolved: "Resolvida",
};
const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-secondary text-secondary-foreground",
  high: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  urgent: "bg-destructive/15 text-destructive",
};

function WhatsAppPage() {
  const { user } = useAuth();
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "open" | "pending" | "resolved" | "mine" | "unassigned">("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const listFn = useServerFn(listWAConversations);
  const msgsFn = useServerFn(getWAMessages);
  const sendFn = useServerFn(sendWAMessage);
  const simIn = useServerFn(simulateIncomingWA);
  const createFn = useServerFn(createWAConversation);
  const updateFn = useServerFn(updateWAConversation);
  const markRead = useServerFn(markWARead);
  const slaFn = useServerFn(getWASlaMetrics);
  const membersFn = useServerFn(listOrgMembers);
  const tmplFn = useServerFn(listWATemplates);

  const convsQ = useQuery({
    queryKey: ["wa", "convs", orgId, filter],
    queryFn: () => listFn({ data: { organization_id: orgId!, status: filter } }),
    enabled: !!orgId,
    refetchInterval: 15000,
  });

  const slaQ = useQuery({
    queryKey: ["wa", "sla", orgId],
    queryFn: () => slaFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  const membersQ = useQuery({
    queryKey: ["wa", "members", orgId],
    queryFn: () => membersFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const tmplQ = useQuery({
    queryKey: ["wa", "tmpl", orgId],
    queryFn: () => tmplFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const msgsQ = useQuery({
    queryKey: ["wa", "msgs", selectedId],
    queryFn: () => msgsFn({ data: { conversation_id: selectedId! } }),
    enabled: !!selectedId,
    refetchInterval: 5000,
  });

  // Realtime
  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel(`wa:${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["wa", "convs"] });
        qc.invalidateQueries({ queryKey: ["wa", "sla"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["wa", "msgs"] });
        qc.invalidateQueries({ queryKey: ["wa", "convs"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [orgId, qc]);

  // Auto-mark read
  useEffect(() => {
    if (selectedId) {
      void markRead({ data: { id: selectedId } }).then(() =>
        qc.invalidateQueries({ queryKey: ["wa", "convs"] }),
      );
    }
  }, [selectedId, markRead, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgsQ.data?.length]);

  const selected = useMemo<WAConversation | undefined>(
    () => convsQ.data?.find((c) => c.id === selectedId),
    [convsQ.data, selectedId],
  );

  const sendMut = useMutation({
    mutationFn: async (body: string) => {
      if (!selectedId || !orgId) return;
      await sendFn({ data: { conversation_id: selectedId, organization_id: orgId, body } });
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["wa", "msgs", selectedId] });
      qc.invalidateQueries({ queryKey: ["wa", "convs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const incMut = useMutation({
    mutationFn: async (body: string) => {
      if (!selectedId || !orgId) return;
      await simIn({ data: { conversation_id: selectedId, organization_id: orgId, body } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa", "msgs", selectedId] });
      qc.invalidateQueries({ queryKey: ["wa", "convs"] });
    },
  });

  const updateMut = useMutation({
    mutationFn: (patch: { status?: "open" | "pending" | "resolved"; priority?: "low" | "normal" | "high" | "urgent"; assigned_to?: string | null }) => {
      if (!selectedId) throw new Error("no selection");
      return updateFn({ data: { id: selectedId, ...patch } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa"] });
      toast.success("Conversa atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!orgId) {
    return <div className="p-8 text-muted-foreground">Selecione uma organização para usar o WhatsApp.</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <PageHeader
        title="WhatsApp"
        subtitle="Inbox unificada multi-atendimento, com SLA, atribuição e templates."
        action={
          <NewConversationDialog
            open={openNew}
            setOpen={setOpenNew}
            onCreate={async (payload) => {
              const res = await createFn({ data: { organization_id: orgId, ...payload } });
              setOpenNew(false);
              setSelectedId(res.id);
              qc.invalidateQueries({ queryKey: ["wa"] });
              toast.success("Conversa criada");
            }}
          />
        }
      />

      <div className="px-6 mb-4">
        <WhatsAppSlaPanel onPick={(id) => setSelectedId(id)} />
      </div>

      {/* SLA strip */}
      <div className="px-6 grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
        <SlaCard label="Abertas" value={slaQ.data?.open ?? 0} />
        <SlaCard label="Pendentes" value={slaQ.data?.pending ?? 0} />
        <SlaCard label="Resolvidas" value={slaQ.data?.resolved ?? 0} />
        <SlaCard label="Sem dono" value={slaQ.data?.unassigned ?? 0} />
        <SlaCard label="1ª resposta (min)" value={slaQ.data?.avg_first_response_minutes ?? "—"} />
        <SlaCard
          label="Estouro SLA 15min"
          value={slaQ.data?.sla_breaches_15min ?? 0}
          tone={slaQ.data?.sla_breaches_15min ? "danger" : "default"}
        />
      </div>

      <div className="flex-1 grid grid-cols-12 gap-4 px-6 pb-6 min-h-0">
        {/* List */}
        <Card className="col-span-12 md:col-span-4 xl:col-span-3 flex flex-col min-h-0">
          <div className="p-3 border-b">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="open">Abertas</TabsTrigger>
                <TabsTrigger value="mine">Minhas</TabsTrigger>
                <TabsTrigger value="unassigned">Sem dono</TabsTrigger>
              </TabsList>
              <TabsList className="grid grid-cols-3 w-full mt-2">
                <TabsTrigger value="pending">Pendentes</TabsTrigger>
                <TabsTrigger value="resolved">Resolvidas</TabsTrigger>
                <TabsTrigger value="all">Todas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ScrollArea className="flex-1">
            <div className="divide-y">
              {(convsQ.data ?? []).map((c) => {
                const waiting = c.status !== "resolved" && !c.first_response_at && c.last_customer_message_at;
                const waitMin = waiting ? minsAgo(c.last_customer_message_at) ?? 0 : 0;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left p-3 hover:bg-accent/50 transition ${
                      selectedId === c.id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {initials(c.contact_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-2">
                          <div className="font-medium truncate">{c.contact_name}</div>
                          <div className="text-xs text-muted-foreground shrink-0">{fmt(c.last_message_at)}</div>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{c.last_message_preview ?? c.contact_phone}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[c.status]}</Badge>
                          {c.priority !== "normal" && (
                            <Badge className={`text-[10px] ${PRIORITY_COLOR[c.priority]}`}>{c.priority}</Badge>
                          )}
                          {c.assigned_name && <Badge variant="secondary" className="text-[10px]">{c.assigned_name}</Badge>}
                          {!c.assigned_to && <Badge variant="outline" className="text-[10px]">sem dono</Badge>}
                          {c.unread_count > 0 && (
                            <Badge className="text-[10px] bg-primary text-primary-foreground">{c.unread_count}</Badge>
                          )}
                          {waiting && waitMin > 15 && (
                            <Badge className="text-[10px] bg-destructive/15 text-destructive">
                              <AlertTriangle className="w-3 h-3 mr-1" />SLA {waitMin}m
                            </Badge>
                          )}
                          {waiting && waitMin <= 15 && (
                            <Badge variant="outline" className="text-[10px]">
                              <Clock className="w-3 h-3 mr-1" />aguardando {waitMin}m
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {convsQ.data?.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhuma conversa neste filtro.
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Thread */}
        <Card className="col-span-12 md:col-span-8 xl:col-span-6 flex flex-col min-h-0">
          {selected ? (
            <>
              <div className="p-3 border-b flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(selected.contact_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{selected.contact_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{selected.contact_phone}</div>
                </div>
                {selected.contact_id && (
                  <Button asChild variant="outline" size="sm" className="h-8">
                    <Link to="/contacts/$id" params={{ id: selected.contact_id }}>
                      <User className="w-3.5 h-3.5 mr-1" />Abrir contato
                    </Link>
                  </Button>
                )}

                <Select
                  value={selected.status}
                  onValueChange={(v) => updateMut.mutate({ status: v as "open" | "pending" | "resolved" })}
                >
                  <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberta</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="resolved">Resolvida</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={selected.priority}
                  onValueChange={(v) => updateMut.mutate({ priority: v as "low" | "normal" | "high" | "urgent" })}
                >
                  <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><UserPlus className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => updateMut.mutate({ assigned_to: user?.id ?? null })}>
                      Atribuir a mim
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateMut.mutate({ assigned_to: null })}>
                      Deixar sem dono
                    </DropdownMenuItem>
                    {(membersQ.data ?? []).filter((m) => m.user_id !== user?.id).map((m) => (
                      <DropdownMenuItem key={m.user_id} onClick={() => updateMut.mutate({ assigned_to: m.user_id })}>
                        {m.full_name ?? m.user_id.slice(0, 8)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => incMut.mutate("Olá, isso é uma mensagem simulada do cliente.")}>
                      Simular msg do cliente
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  {(msgsQ.data ?? []).map((m) => (
                    <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                          m.direction === "out"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        }`}
                      >
                        {m.direction === "out" && m.sender_name && (
                          <div className="text-[10px] opacity-80 mb-0.5">{m.sender_name}</div>
                        )}
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-70">
                          {fmt(m.created_at)}
                          {m.direction === "out" && (
                            m.status === "read" ? <CheckCheck className="w-3 h-3" /> :
                            m.status === "delivered" ? <CheckCheck className="w-3 h-3 opacity-60" /> :
                            <Check className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              <div className="border-t p-3 space-y-2">
                {(tmplQ.data?.length ?? 0) > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <FileText className="w-3 h-3 mr-1" /> Template
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {(tmplQ.data ?? []).map((t) => (
                        <DropdownMenuItem key={t.id} onClick={() => setDraft(t.body)}>
                          {t.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <div className="flex gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    rows={2}
                    className="resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (draft.trim()) sendMut.mutate(draft.trim());
                      }
                    }}
                  />
                  <Button
                    onClick={() => draft.trim() && sendMut.mutate(draft.trim())}
                    disabled={!draft.trim() || sendMut.isPending}
                    className="self-end"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageCircle className="h-10 w-10 mb-2 opacity-50" />
              <p>Selecione uma conversa para começar.</p>
            </div>
          )}
        </Card>

        {/* Customer 360 rail — só em telas largas */}
        <Card className="hidden xl:flex col-span-12 xl:col-span-3 flex-col min-h-0 overflow-hidden">
          {selected ? (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* Contato */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-[var(--gradient-primary)] text-primary-foreground text-sm font-semibold">
                        {initials(selected.contact_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{selected.contact_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{selected.contact_phone}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Button asChild variant="outline" size="sm" className="h-8 px-0">
                      <a
                        href={whatsappLink(selected.contact_phone)}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir no WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="h-8 px-0">
                      <a href={`tel:${selected.contact_phone}`} title="Ligar">
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 px-0" disabled title="E-mail">
                      <Mail className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Status & atribuição (resumo) */}
                <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[selected.status]}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Prioridade</span>
                    <Badge className={`text-[10px] ${PRIORITY_COLOR[selected.priority]}`}>{selected.priority}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Atribuída a</span>
                    <span className="font-medium truncate max-w-[60%] text-right">
                      {selected.assigned_name ?? <span className="text-muted-foreground italic">sem dono</span>}
                    </span>
                  </div>
                </div>

                {/* Atalhos para perfil */}
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1">
                    Perfil
                  </p>
                  {selected.contact_id ? (
                    <Button asChild variant="ghost" size="sm" className="w-full justify-start h-8">
                      <Link to="/contacts/$id" params={{ id: selected.contact_id }}>
                        <User className="h-3.5 w-3.5 mr-2" /> Abrir contato
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground px-2">
                      Sem contato vinculado.
                    </p>
                  )}
                  {selected.company_id && (
                    <Button asChild variant="ghost" size="sm" className="w-full justify-start h-8">
                      <Link to="/companies/$id" params={{ id: selected.company_id }}>
                        <Building2 className="h-3.5 w-3.5 mr-2" /> Customer 360
                      </Link>
                    </Button>
                  )}
                </div>

                {/* IA — próxima ação sugerida */}
                {selected.contact_id && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 px-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        IA sugere
                      </p>
                    </div>
                    <NextActionBlock surface="contact" title="" limit={2} />
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
              <Sparkles className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Selecione uma conversa para ver o Customer 360 e sugestões da IA.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SlaCard({ label, value, tone = "default" }: { label: string; value: number | string; tone?: "default" | "danger" }) {
  return (
    <Card className={`p-3 ${tone === "danger" && value !== 0 ? "border-destructive/40" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${tone === "danger" && value !== 0 ? "text-destructive" : ""}`}>{value}</div>
    </Card>
  );
}

function NewConversationDialog({
  open, setOpen, onCreate,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onCreate: (p: { contact_name: string; contact_phone: string; first_message?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [first, setFirst] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" />Nova conversa</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova conversa WhatsApp</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Nome do contato</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: João Silva" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Telefone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11 99999-9999" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Primeira mensagem do cliente (opcional)</label>
            <Textarea value={first} onChange={(e) => setFirst(e.target.value)} rows={3} placeholder="Olá, tenho interesse no produto..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            disabled={!name.trim() || !phone.trim() || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onCreate({
                  contact_name: name.trim(),
                  contact_phone: phone.trim(),
                  first_message: first.trim() || undefined,
                });
                setName(""); setPhone(""); setFirst("");
              } finally {
                setBusy(false);
              }
            }}
          >
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
