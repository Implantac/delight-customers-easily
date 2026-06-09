import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
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
  Instagram, Facebook, Linkedin, Mail, Phone, MessageCircle, Twitter
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
    <div className="p-6 h-[calc(100vh-3rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <PageHeader
          icon={MessageSquare}
          title="Chat do Site"
          subtitle="Conversas iniciadas pelos visitantes do seu site"
        />
        <Button asChild variant="outline" size="sm">
          <Link to="/settings/site-chat">
            <SettingsIcon className="h-4 w-4 mr-2" /> Configurar widget
          </Link>
        </Button>
      </div>

      <Card className="flex-1 grid grid-cols-[320px_1fr] overflow-hidden">
        {/* Lista */}
        <div className="border-r overflow-y-auto">
          {sessions.isLoading && (
            <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          )}
          {!sessions.isLoading && list.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">
              Nenhuma conversa ainda.<br />
              <Link to="/settings/site-chat" className="text-primary underline">
                Instale o widget no seu site
              </Link>
            </div>
          )}
          {list.map((s: any) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left p-3 border-b hover:bg-muted/50 transition ${
                selectedId === s.id ? "bg-muted" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm truncate">
                  {s.visitor_name || s.visitor_email || "Visitante"}
                </div>
                {s.unread_for_agent > 0 && (
                  <Badge variant="default" className="h-5 px-1.5 text-xs">novo</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {s.visitor_email || s.visitor_phone || "anônimo"}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <span>{formatDistanceToNow(new Date(s.last_message_at), { addSuffix: true, locale: ptBR })}</span>
                {s.status === "closed" && <Badge variant="secondary" className="h-4 text-[10px]">encerrada</Badge>}
                {s.lead_id && <Badge variant="outline" className="h-4 text-[10px]">lead</Badge>}
              </div>
            </button>
          ))}
        </div>

        {/* Thread */}
        <div className="flex flex-col overflow-hidden">
          {!selectedId && (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Selecione uma conversa
            </div>
          )}
          {selectedId && (
            <>
              <div className="border-b p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{session?.visitor_name || "Visitante"}</div>
                  <div className="text-xs text-muted-foreground">
                    {session?.visitor_email || session?.visitor_phone || "anônimo"}
                    {session?.page_url && (
                      <a href={session.page_url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
                        origem <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => convertMut.mutate()} disabled={convertMut.isPending}>
                    <UserPlus className="h-4 w-4 mr-1" /> Virar lead
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => closeMut.mutate()} disabled={closeMut.isPending}>
                    <X className="h-4 w-4 mr-1" /> Encerrar
                  </Button>
                </div>
              </div>
              <CardContent ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.map((m: any) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender_kind === "agent" ? "justify-end" : m.sender_kind === "system" ? "justify-center" : "justify-start"}`}
                  >
                    <div
                      className={`rounded-lg px-3 py-2 text-sm max-w-[75%] whitespace-pre-wrap ${
                        m.sender_kind === "agent"
                          ? "bg-primary text-primary-foreground"
                          : m.sender_kind === "system"
                          ? "bg-transparent text-muted-foreground text-xs"
                          : "bg-muted"
                      }`}
                    >
                      {m.body}
                    </div>
                  </div>
                ))}
              </CardContent>
              <div className="border-t p-3 flex gap-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Responder…"
                  rows={2}
                  className="resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (reply.trim()) replyMut.mutate(reply.trim());
                    }
                  }}
                />
                <Button onClick={() => replyMut.mutate(reply.trim())} disabled={!reply.trim() || replyMut.isPending}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
