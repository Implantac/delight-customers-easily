import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LifeBuoy, Plus, Search, AlertCircle, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/lib/org";
import { listTickets, createTicket } from "@/lib/tickets.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/tickets")({
  component: TicketsPage,
});

const STATUS_META: Record<string, { label: string; icon: any; color: string }> = {
  open: { label: "Aberto", icon: AlertCircle, color: "bg-blue-100 text-blue-800" },
  in_progress: { label: "Em andamento", icon: Loader2, color: "bg-amber-100 text-amber-800" },
  pending: { label: "Aguardando", icon: Clock, color: "bg-slate-100 text-slate-800" },
  resolved: { label: "Resolvido", icon: CheckCircle2, color: "bg-green-100 text-green-800" },
  closed: { label: "Fechado", icon: XCircle, color: "bg-zinc-200 text-zinc-700" },
};

const PRIORITY_META: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  normal: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

function TicketsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const list = useServerFn(listTickets);
  const create = useServerFn(createTicket);
  const [tab, setTab] = useState<"all" | "open" | "in_progress" | "pending" | "resolved" | "closed">("open");
  const [assignee, setAssignee] = useState<"all" | "me">("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    description: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    channel: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["tickets", orgId, tab, assignee, search],
    queryFn: () =>
      list({
        data: {
          organization_id: orgId!,
          status: tab,
          assignee,
          search: search || undefined,
        },
      }),
    enabled: !!orgId,
  });

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          organization_id: orgId!,
          subject: form.subject,
          description: form.description || undefined,
          priority: form.priority,
          channel: form.channel || null,
        },
      }),
    onSuccess: () => {
      toast.success("Ticket criado");
      setOpen(false);
      setForm({ subject: "", description: "", priority: "normal", channel: "" });
      qc.invalidateQueries({ queryKey: ["tickets", orgId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const tickets = data?.tickets ?? [];
  const counts = data?.counts ?? { open: 0, in_progress: 0, pending: 0, resolved: 0, closed: 0, total: 0 };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie chamados e solicitações de clientes.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Novo ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo ticket</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Assunto</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  maxLength={200}
                />
              </div>
              <div className="grid gap-2">
                <Label>Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Prioridade</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm({ ...form, priority: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Canal</Label>
                  <Input
                    value={form.channel}
                    onChange={(e) => setForm({ ...form, channel: e.target.value })}
                    placeholder="email, whatsapp, telefone..."
                    maxLength={40}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={!form.subject || createMut.isPending} onClick={() => createMut.mutate()}>
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["open", "in_progress", "pending", "resolved", "closed"] as const).map((k) => {
          const meta = STATUS_META[k];
          const Icon = meta.icon;
          return (
            <Card key={k} className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setTab(k)}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{counts[k] ?? 0}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{meta.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por assunto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={assignee} onValueChange={(v) => setAssignee(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            <SelectItem value="me">Atribuídos a mim</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="open">Abertos</TabsTrigger>
          <TabsTrigger value="in_progress">Em andamento</TabsTrigger>
          <TabsTrigger value="pending">Aguardando</TabsTrigger>
          <TabsTrigger value="resolved">Resolvidos</TabsTrigger>
          <TabsTrigger value="closed">Fechados</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5" /> {tickets.length} tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum ticket encontrado.
            </p>
          ) : (
            <div className="divide-y">
              {tickets.map((t) => {
                const status = STATUS_META[t.status] ?? STATUS_META.open;
                const SIcon = status.icon;
                return (
                  <Link
                    key={t.id}
                    to="/tickets/$id"
                    params={{ id: t.id }}
                    className="flex items-center gap-3 py-3 hover:bg-accent rounded px-2 -mx-2"
                  >
                    <SIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{t.subject}</span>
                        <Badge className={`${status.color} hover:${status.color}`}>{status.label}</Badge>
                        <Badge variant="outline" className={PRIORITY_META[t.priority]}>
                          {t.priority}
                        </Badge>
                        {t.channel && (
                          <Badge variant="outline" className="text-xs">{t.channel}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {t.contact_name && <span>{t.contact_name} · </span>}
                        criado{" "}
                        {formatDistanceToNow(new Date(t.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
