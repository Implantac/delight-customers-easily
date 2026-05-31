import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mail, MessageSquare, Phone, Smartphone, Plus, Copy, Trash2, Pencil, FileText } from "lucide-react";
import { toast } from "sonner";
import { listTemplates, upsertTemplate, deleteTemplate, markTemplateUsed } from "@/lib/templates.functions";

export const Route = createFileRoute("/_app/templates")({ component: TemplatesPage });

type Channel = "email" | "whatsapp" | "sms" | "call_script";

const CHANNEL_META: Record<Channel, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  email: { label: "Email", icon: Mail, tone: "text-blue-500" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, tone: "text-emerald-500" },
  sms: { label: "SMS", icon: Smartphone, tone: "text-violet-500" },
  call_script: { label: "Script de ligação", icon: Phone, tone: "text-amber-500" },
};

const MERGE_TAGS = ["{{contact.name}}", "{{contact.first_name}}", "{{company.name}}", "{{deal.title}}", "{{deal.value}}", "{{user.name}}"];

function TemplatesPage() {
  const { user } = useAuth();
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const call = useServerFn(listTemplates);
  const upsert = useServerFn(upsertTemplate);
  const del = useServerFn(deleteTemplate);
  const markUsed = useServerFn(markTemplateUsed);

  const [editing, setEditing] = useState<{
    id?: string; name: string; channel: Channel; category: string; subject: string; body: string;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["templates", orgId],
    enabled: !!orgId,
    queryFn: () => call({ data: { organization_id: orgId! } }),
    refetchOnWindowFocus: false,
  });

  const items = (data?.items ?? []).filter((t) => channelFilter === "all" || t.channel === channelFilter);

  const startNew = () => {
    setEditing({ name: "", channel: "email", category: "", subject: "", body: "" });
    setOpen(true);
  };
  const startEdit = (t: typeof items[number]) => {
    setEditing({
      id: t.id, name: t.name, channel: t.channel as Channel,
      category: t.category ?? "", subject: t.subject ?? "", body: t.body,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!editing || !orgId) return;
    if (!editing.name.trim() || !editing.body.trim()) {
      toast.error("Nome e corpo são obrigatórios");
      return;
    }
    try {
      await upsert({
        data: {
          organization_id: orgId,
          id: editing.id,
          name: editing.name.trim(),
          channel: editing.channel,
          category: editing.category || null,
          subject: editing.subject || null,
          body: editing.body,
        },
      });
      toast.success(editing.id ? "Template atualizado" : "Template criado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["templates", orgId] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["templates", orgId] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const copyBody = async (t: typeof items[number]) => {
    const text = [t.subject ? `Assunto: ${t.subject}` : null, t.body].filter(Boolean).join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência");
    try { await markUsed({ data: { id: t.id } }); qc.invalidateQueries({ queryKey: ["templates", orgId] }); } catch {}
  };

  const insertTag = (tag: string) => {
    if (!editing) return;
    setEditing({ ...editing, body: `${editing.body}${tag}` });
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        icon={FileText}
        title="Templates de mensagens"
        subtitle="Biblioteca compartilhada de emails, WhatsApp e scripts. Use merge tags para personalizar em segundos."
        action={<Button onClick={startNew}><Plus className="mr-2 h-4 w-4" />Novo template</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={channelFilter === "all" ? "default" : "outline"} onClick={() => setChannelFilter("all")}>Todos</Button>
        {(Object.keys(CHANNEL_META) as Channel[]).map((c) => {
          const M = CHANNEL_META[c];
          const Icon = M.icon;
          return (
            <Button key={c} size="sm" variant={channelFilter === c ? "default" : "outline"} onClick={() => setChannelFilter(c)}>
              <Icon className="mr-1 h-3 w-3" />{M.label}
            </Button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0,1,2,3,4,5].map((i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum template ainda. Crie o primeiro.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => {
            const M = CHANNEL_META[t.channel as Channel] ?? CHANNEL_META.email;
            const Icon = M.icon;
            const mine = t.created_by === user?.id;
            return (
              <Card key={t.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${M.tone}`} />
                      <span className="truncate font-medium">{t.name}</span>
                    </div>
                    {t.category && <Badge variant="outline" className="mt-1 text-xs">{t.category}</Badge>}
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">{t.usage_count} usos</Badge>
                </div>
                {t.subject && <p className="mt-3 truncate text-xs text-muted-foreground">Assunto: {t.subject}</p>}
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>
                <div className="mt-auto flex items-center gap-2 pt-4">
                  <Button size="sm" className="flex-1" onClick={() => copyBody(t)}>
                    <Copy className="mr-1 h-3 w-3" />Copiar
                  </Button>
                  {mine && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => startEdit(t)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => remove(t.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><span /></DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar template" : "Novo template"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex: Follow-up pós-reunião" />
                </div>
                <div>
                  <Label>Canal</Label>
                  <Select value={editing.channel} onValueChange={(v) => setEditing({ ...editing, channel: v as Channel })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CHANNEL_META) as Channel[]).map((c) => (
                        <SelectItem key={c} value={c}>{CHANNEL_META[c].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Prospecção, Follow-up, Proposta..." />
                </div>
                <div>
                  <Label>Assunto (se email)</Label>
                  <Input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Corpo</Label>
                <Textarea rows={10} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} placeholder={"Olá {{contact.first_name}},\n\nObrigado pela conversa de hoje sobre {{deal.title}}..."} />
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground">Inserir tag:</span>
                  {MERGE_TAGS.map((tag) => (
                    <Button key={tag} type="button" size="sm" variant="outline" className="h-6 px-2 text-xs font-mono" onClick={() => insertTag(tag)}>
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
