import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Send, Lock } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { getTicket, updateTicket, addComment } from "@/lib/tickets.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/tickets/$id")({
  component: TicketDetail,
});

const STATUS_OPTIONS = [
  { v: "open", label: "Aberto" },
  { v: "in_progress", label: "Em andamento" },
  { v: "pending", label: "Aguardando" },
  { v: "resolved", label: "Resolvido" },
  { v: "closed", label: "Fechado" },
];

const PRIORITY_OPTIONS = [
  { v: "low", label: "Baixa" },
  { v: "normal", label: "Normal" },
  { v: "high", label: "Alta" },
  { v: "urgent", label: "Urgente" },
];

function TicketDetail() {
  const { id } = Route.useParams();
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const fetchOne = useServerFn(getTicket);
  const update = useServerFn(updateTicket);
  const comment = useServerFn(addComment);

  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ticket", id, orgId],
    enabled: !!orgId,
    queryFn: () => fetchOne({ data: { id, organization_id: orgId! } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ticket", id] });

  const updateMut = useMutation({
    mutationFn: (p: any) => update({ data: { id, organization_id: orgId!, ...p } }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const commentMut = useMutation({
    mutationFn: () =>
      comment({
        data: {
          organization_id: orgId!,
          ticket_id: id,
          body,
          is_internal: isInternal,
        },
      }),
    onSuccess: () => {
      toast.success("Comentário enviado");
      setBody("");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const t = data?.ticket;
  const comments = data?.comments ?? [];

  return (
    <div className="flex flex-col gap-4 p-6 max-w-4xl mx-auto w-full">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link to="/tickets">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Link>
      </Button>

      {isLoading || !t ? (
        <Skeleton className="h-[300px] w-full" />
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-bold">{t.subject}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Criado em {format(new Date(t.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4">
            <div className="flex flex-col gap-4">
              {t.description && (
                <Card>
                  <CardContent className="pt-6">
                    <p className="whitespace-pre-wrap text-sm">{t.description}</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Conversa ({comments.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Sem comentários ainda.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {comments.map((c) => {
                        const initials = (c.author_name || "?")
                          .split(" ")
                          .map((s) => s[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase();
                        return (
                          <div
                            key={c.id}
                            className={`flex gap-3 p-3 rounded-lg ${
                              c.is_internal ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200" : "bg-muted/40"
                            }`}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{c.author_name}</span>
                                {c.is_internal && (
                                  <Badge variant="secondary" className="text-xs gap-1">
                                    <Lock className="h-3 w-3" /> nota interna
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(c.created_at), {
                                    addSuffix: true,
                                    locale: ptBR,
                                  })}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap mt-1">{c.body}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-4 space-y-2">
                    <Textarea
                      placeholder="Escreva uma resposta..."
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={3}
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="internal"
                          checked={isInternal}
                          onCheckedChange={setIsInternal}
                        />
                        <Label htmlFor="internal" className="text-sm">
                          Nota interna
                        </Label>
                      </div>
                      <Button
                        disabled={!body.trim() || commentMut.isPending}
                        onClick={() => commentMut.mutate()}
                      >
                        <Send className="mr-2 h-4 w-4" /> Enviar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detalhes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={t.status}
                    onValueChange={(v) => updateMut.mutate({ status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Prioridade</Label>
                  <Select
                    value={t.priority}
                    onValueChange={(v) => updateMut.mutate({ priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {t.channel && (
                  <div>
                    <Label className="text-xs">Canal</Label>
                    <p className="text-sm mt-1">{t.channel}</p>
                  </div>
                )}
                {t.resolved_at && (
                  <div>
                    <Label className="text-xs">Resolvido em</Label>
                    <p className="text-sm mt-1">
                      {format(new Date(t.resolved_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
