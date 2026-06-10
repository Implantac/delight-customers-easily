import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import { cn } from "@/lib/utils";
import {
  listSiteChatSessions,
  listSiteChatMessages,
  replySiteChat,
  closeSiteChatSession,
  convertSiteChatToLead,
} from "@/lib/site-chat.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { 
  MessageSquare, Send, Loader2, ExternalLink, UserPlus, X, Settings as SettingsIcon,
  Mail, Phone, MessageCircle, LayoutGrid
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/site-chat")({
  component: SiteChatInboxPage,
});



function SiteChatInboxPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const listFn = useServerFn(listSiteChatSessions);
  const msgsFn = useServerFn(listSiteChatMessages);
  const replyFn = useServerFn(replySiteChat);
  const closeFn = useServerFn(closeSiteChatSession);
  const convertFn = useServerFn(convertSiteChatToLead);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const sessions = useQuery({
    queryKey: ["site-chat-sessions", orgId],
    queryFn: () => listFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 8000,
  });

  const thread = useQuery({
    queryKey: ["site-chat-messages", selectedId],
    queryFn: () => msgsFn({ data: { session_id: selectedId! } }),
    enabled: !!selectedId,
    refetchInterval: selectedId ? 4000 : false,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [thread.data]);

  const replyMut = useMutation({
    mutationFn: (body: string) =>
      replyFn({ data: { session_id: selectedId!, organization_id: orgId!, body } }),
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["site-chat-messages", selectedId] });
      qc.invalidateQueries({ queryKey: ["site-chat-sessions", orgId] });
    },
    onError: (e: any) => toast.error("Falha ao enviar", { description: e?.message }),
  });

  const closeMut = useMutation({
    mutationFn: () => closeFn({ data: { session_id: selectedId! } }),
    onSuccess: () => {
      toast.success("Conversa encerrada");
      qc.invalidateQueries({ queryKey: ["site-chat-sessions", orgId] });
    },
  });

  const convertMut = useMutation({
    mutationFn: () => convertFn({ data: { session_id: selectedId! } }),
    onSuccess: (r: any) => {
      if (r.already) toast.info("Lead já criado anteriormente");
      else toast.success("Lead criado em Marketing");
      qc.invalidateQueries({ queryKey: ["site-chat-sessions", orgId] });
    },
    onError: (e: any) => toast.error("Falha ao criar lead", { description: e?.message }),
  });

  const list = sessions.data ?? [];
  const session = thread.data?.session;
  const messages = thread.data?.messages ?? [];

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <PageHeader
          icon={MessageSquare}
          title="Omnichannel CRM Inbox"
          subtitle="Centralize conversas de WhatsApp, Instagram, Chat e E-mail em um único lugar vinculado aos seus clientes."
        />
        <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse mr-2" /> 4 Canais Ativos
            </Badge>
            <Button asChild variant="outline" size="sm">
            <Link to="/settings/site-chat">
                <SettingsIcon className="h-4 w-4 mr-2" /> Configurações
            </Link>
            </Button>
        </div>
      </div>

      <Card className="flex-1 grid grid-cols-[360px_1fr] overflow-hidden border-border/40 shadow-xl">
        {/* Lista de Conversas com Filtro de Canal */}
        <div className="border-r flex flex-col bg-muted/20">
          <div className="p-3 border-b flex gap-1 overflow-x-auto no-scrollbar">
             <ChannelFilter icon={LayoutGrid} active />
             <ChannelFilter icon={MessageCircle} color="text-emerald-500" />
             <ChannelFilter icon={MessageSquare} color="text-rose-500" />
             <ChannelFilter icon={MessageSquare} color="text-blue-600" />
             <ChannelFilter icon={Mail} color="text-violet-500" />
          </div>
          
          <div className="overflow-y-auto flex-1">
            {sessions.isLoading && (
                <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando Inbox...
                </div>
            )}
            
            {list.map((s: any) => (
                <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left p-4 border-b hover:bg-muted/50 transition relative group ${
                    selectedId === s.id ? "bg-background shadow-inner" : ""
                }`}
                >
                <div className="flex items-center gap-3">
                    <div className="relative">
                         <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                            {s.visitor_name?.[0] || "?"}
                         </div>
                         <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white flex items-center justify-center shadow-sm border border-border/40">
                             <MessageSquare className="h-3 w-3 text-primary" />
                         </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <div className="font-bold text-sm truncate pr-2">
                            {s.visitor_name || s.visitor_email || "Interesse Comercial"}
                            </div>
                            <span className="text-[10px] text-muted-foreground uppercase font-medium">
                                {formatDistanceToNow(new Date(s.last_message_at), { addSuffix: true, locale: ptBR })}
                            </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {s.visitor_email || "Aguardando vínculo..."}
                        </div>
                    </div>
                </div>
                {s.unread_for_agent > 0 && (
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
                </button>
            ))}
          </div>
        </div>

        {/* Área da Conversa */}
        <div className="flex flex-col bg-background overflow-hidden relative">
          {!selectedId && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="p-6 rounded-full bg-primary/5">
                <MessageSquare className="h-12 w-12 text-primary opacity-20" />
              </div>
              <div>
                <h3 className="font-bold">Selecione um atendimento</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Visualize o histórico completo e interaja com o cliente em tempo real independente do canal.
                </p>
              </div>
            </div>
          )}
          
          {selectedId && (
            <>
              <div className="border-b p-4 flex items-center justify-between bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        {session?.visitor_name?.[0] || "?"}
                    </div>
                    <div>
                        <div className="font-bold text-sm">{session?.visitor_name || "Visitante"}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                             <MessageSquare className="h-3 w-3" /> Chat via Site · 
                             <span className="text-emerald-500 font-bold">Online</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-full h-9" onClick={() => convertMut.mutate()} disabled={convertMut.isPending}>
                    <UserPlus className="h-4 w-4 mr-2" /> Criar Lead
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-full h-9 hover:bg-destructive/10 hover:text-destructive" onClick={() => closeMut.mutate()} disabled={closeMut.isPending}>
                    <X className="h-4 w-4 mr-2" /> Encerrar
                  </Button>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/[0.03]">
                {messages.map((m: any) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender_kind === "agent" ? "justify-end" : m.sender_kind === "system" ? "justify-center" : "justify-start"}`}
                  >
                    <div className={cn("max-w-[70%] space-y-1", m.sender_kind === "agent" ? "items-end text-right" : "")}>
                        <div
                            className={cn(
                                "rounded-2xl px-4 py-3 text-sm shadow-sm",
                                m.sender_kind === "agent"
                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                : m.sender_kind === "system"
                                ? "bg-muted/50 text-muted-foreground text-[10px] uppercase font-bold tracking-widest border border-border/40"
                                : "bg-card border border-border/40 rounded-tl-none"
                            )}
                        >
                            {m.body}
                        </div>
                        <div className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                            {formatDistanceToNow(new Date(m.created_at), { locale: ptBR })}
                        </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t bg-card/50">
                <div className="relative group">
                    <Textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Escreva sua resposta comercial..."
                        rows={3}
                        className="resize-none pr-14 pl-4 py-4 rounded-2xl border-primary/20 focus:border-primary transition-all shadow-lg"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (reply.trim()) replyMut.mutate(reply.trim());
                            }
                        }}
                    />
                    <Button 
                        size="icon" 
                        className="absolute right-3 bottom-3 h-10 w-10 rounded-xl shadow-glow transition-all"
                        onClick={() => replyMut.mutate(reply.trim())} 
                        disabled={!reply.trim() || replyMut.isPending}
                    >
                        {replyMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-widest px-2">
                    <div className="flex gap-4">
                        <button className="hover:text-primary transition-colors">Templates</button>
                        <button className="hover:text-primary transition-colors">Anexos</button>
                        <button className="hover:text-primary transition-colors">Sugestão IA</button>
                    </div>
                    <span>Enter para enviar</span>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function ChannelFilter({ icon: Icon, active, color }: any) {
    return (
        <button className={cn(
            "p-2.5 rounded-lg border transition-all shrink-0",
            active ? "bg-primary border-primary shadow-glow" : "bg-card border-border/60 hover:border-primary/40",
            color && !active ? color : ""
        )}>
            <Icon className={cn("h-4 w-4", active ? "text-primary-foreground" : "")} />
        </button>
    );
}

function StatusBadge({ children, active }: any) {
    return (
        <span className={cn(
            "h-2 w-2 rounded-full",
            active ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
        )} />
    );
}

