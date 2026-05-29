import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  listConversations, listMessages, sendMessage, listOrgMembers, startDirectConversation,
} from "@/lib/chat.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { MessageSquare, Plus, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/chat")({ component: ChatPage });

function initialsOf(name: string | null | undefined) {
  return (name ?? "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}
function fmtTime(s: string) {
  const d = new Date(s);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function ChatPage() {
  const { user } = useAuth();
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const runList = useServerFn(listConversations);
  const runMsgs = useServerFn(listMessages);
  const runSend = useServerFn(sendMessage);
  const runMembers = useServerFn(listOrgMembers);
  const runStart = useServerFn(startDirectConversation);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const convs = useQuery({
    queryKey: ["chat-convs", orgId],
    enabled: !!orgId,
    queryFn: () => runList({ data: { organization_id: orgId! } }),
    refetchInterval: 15000,
  });

  const msgs = useQuery({
    queryKey: ["chat-msgs", activeId],
    enabled: !!activeId,
    queryFn: () => runMsgs({ data: { conversation_id: activeId! } }),
  });

  const members = useQuery({
    queryKey: ["chat-members", orgId],
    enabled: !!orgId && newOpen,
    queryFn: () => runMembers({ data: { organization_id: orgId! } }),
  });

  const active = useMemo(() => convs.data?.find((c) => c.id === activeId), [convs.data, activeId]);

  // realtime: refetch on new messages
  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel(`org-msgs-${orgId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: any) => {
        const newCid = payload.new?.conversation_id;
        qc.invalidateQueries({ queryKey: ["chat-convs", orgId] });
        if (newCid && newCid === activeId) {
          qc.invalidateQueries({ queryKey: ["chat-msgs", activeId] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, activeId, qc]);

  // auto-scroll
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.data]);

  // auto-select first
  useEffect(() => {
    if (!activeId && convs.data && convs.data.length > 0) setActiveId(convs.data[0].id);
  }, [convs.data, activeId]);

  const sendM = useMutation({
    mutationFn: runSend,
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["chat-msgs", activeId] });
      qc.invalidateQueries({ queryKey: ["chat-convs", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startM = useMutation({
    mutationFn: runStart,
    onSuccess: (r) => {
      setActiveId(r.id);
      setNewOpen(false);
      qc.invalidateQueries({ queryKey: ["chat-convs", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const titleOf = (c: NonNullable<typeof convs.data>[number]) =>
    c.title ?? c.participants.filter((p) => p.user_id !== user?.id).map((p) => p.full_name ?? "Sem nome").join(", ") ?? "Conversa";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
      <PageHeader
        title="Chat da equipe"
        subtitle="Conversas internas em tempo real, escopadas à sua organização."
        action={
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Nova conversa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Iniciar conversa</DialogTitle></DialogHeader>
              {members.isLoading ? <Skeleton className="h-40" /> : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {(members.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum outro membro nesta organização.</p>
                  ) : members.data!.map((m) => (
                    <button
                      key={m.user_id}
                      onClick={() => startM.mutate({ data: { organization_id: orgId!, other_user_id: m.user_id } })}
                      className="flex items-center gap-3 w-full p-3 rounded-md hover:bg-accent/50 text-left"
                    >
                      <Avatar className="h-9 w-9"><AvatarFallback>{initialsOf(m.full_name)}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{m.full_name ?? "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 min-h-0 mt-4">
        {/* conv list */}
        <Card className="overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            {convs.isLoading ? (
              <div className="p-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : (convs.data ?? []).length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
                Sem conversas ainda. Clique em "Nova conversa".
              </div>
            ) : (
              <ul>
                {convs.data!.map((c) => {
                  const t = titleOf(c);
                  const isActive = c.id === activeId;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setActiveId(c.id)}
                        className={`w-full flex items-center gap-3 p-3 border-b transition-colors ${isActive ? "bg-accent/60" : "hover:bg-accent/30"}`}
                      >
                        <Avatar className="h-9 w-9 shrink-0"><AvatarFallback>{initialsOf(t)}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="font-medium text-sm truncate">{t}</p>
                            <span className="text-[10px] text-muted-foreground shrink-0">{fmtTime(c.last_message_at)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground truncate">{c.last_message?.body ?? "Sem mensagens"}</p>
                            {c.unread > 0 && <Badge className="h-5 px-1.5 text-[10px] shrink-0">{c.unread}</Badge>}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </Card>

        {/* messages */}
        <Card className="overflow-hidden flex flex-col min-h-0">
          {!activeId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Selecione uma conversa
            </div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center gap-3">
                <Avatar className="h-8 w-8"><AvatarFallback>{initialsOf(active ? titleOf(active) : "?")}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{active ? titleOf(active) : "Conversa"}</p>
                  <p className="text-xs text-muted-foreground">{active?.participants.length ?? 0} participantes</p>
                </div>
              </div>
              <ScrollArea className="flex-1 p-4">
                {msgs.isLoading ? (
                  <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
                ) : (msgs.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">Diga "olá" para começar.</p>
                ) : (
                  <ul className="space-y-2">
                    {msgs.data!.map((m: any) => {
                      const mine = m.sender_id === user?.id;
                      const senderName = active?.participants.find((p) => p.user_id === m.sender_id)?.full_name ?? null;
                      return (
                        <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                            {!mine && <p className="text-[10px] font-medium opacity-70 mb-0.5">{senderName ?? "Membro"}</p>}
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                            <p className={`text-[10px] mt-1 ${mine ? "opacity-70" : "text-muted-foreground"} text-right`}>{fmtTime(m.created_at)}</p>
                          </div>
                        </li>
                      );
                    })}
                    <div ref={endRef} />
                  </ul>
                )}
              </ScrollArea>
              <form
                className="p-3 border-t flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!draft.trim() || !orgId) return;
                  sendM.mutate({ data: { conversation_id: activeId, organization_id: orgId, body: draft.trim() } });
                }}
              >
                <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreva uma mensagem..." />
                <Button type="submit" size="icon" disabled={!draft.trim() || sendM.isPending}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
