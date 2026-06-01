import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import {
  listDiagnosticMessages,
  sendDiagnosticMessage,
} from "@/lib/erp-diagnostic.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { HelpCircle, Send, ChevronLeft, Loader2, Bot, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_app/integrations/diagnostic")({
  component: DiagnosticChatPage,
});

function DiagnosticChatPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const listFn = useServerFn(listDiagnosticMessages);
  const sendFn = useServerFn(sendDiagnosticMessage);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const msgs = useQuery({
    queryKey: ["diag-msgs", orgId],
    queryFn: () => listFn({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.data]);

  const sendMut = useMutation({
    mutationFn: (content: string) =>
      sendFn({ data: { organizationId: orgId!, content } }),
    onSuccess: () => {
      setInput("");
      qc.invalidateQueries({ queryKey: ["diag-msgs", orgId] });
    },
    onError: (e: any) =>
      toast.error("Não consegui responder agora", { description: e?.message }),
  });

  function submit() {
    const v = input.trim();
    if (!v) return;
    sendMut.mutate(v);
  }

  const messages = msgs.data?.messages ?? [];

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto h-[calc(100vh-3rem)] flex flex-col">
      <Link to="/integrations" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4 mr-1" /> Voltar para Integrações
      </Link>
      <PageHeader
        icon={HelpCircle}
        title="Diagnóstico por chat"
        subtitle="Descreva o problema em linguagem natural. A IA pergunta e sugere o que fazer."
      />

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !sendMut.isPending && (
            <div className="text-center text-sm text-muted-foreground py-12">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Olá! Conte o que está acontecendo com sua integração.<br />
              Ex: <em>"Os clientes do Omie não estão aparecendo no CRM."</em>
            </div>
          )}
          {messages.map((m: any) => (
            <div
              key={m.id}
              className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role !== "user" && (
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`rounded-lg px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {m.content}
              </div>
              {m.role === "user" && (
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {sendMut.isPending && (
            <div className="flex gap-2 items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Pensando…
            </div>
          )}
        </CardContent>
        <div className="border-t p-3 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Descreva o problema…"
            rows={2}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={sendMut.isPending}
          />
          <Button onClick={submit} disabled={!input.trim() || sendMut.isPending} className="gap-2">
            <Send className="h-4 w-4" /> Enviar
          </Button>
        </div>
      </Card>
    </div>
  );
}
