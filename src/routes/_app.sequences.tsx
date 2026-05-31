import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Workflow, Plus, Pencil, Trash2, Users as UsersIcon, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { listSequences, upsertSequence, deleteSequence } from "@/lib/sequences.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sequences")({ component: SequencesPage });

function SequencesPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const canManage = useCanManage();
  const fetchSeq = useServerFn(listSequences);
  const upsertFn = useServerFn(upsertSequence);
  const delFn = useServerFn(deleteSequence);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id?: string; name: string; description: string; active: boolean }>({
    name: "",
    description: "",
    active: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["sequences", orgId],
    queryFn: () => fetchSeq({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const upsert = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: editing.id,
          organization_id: orgId!,
          name: editing.name.trim(),
          description: editing.description.trim() || null,
          active: editing.active,
        },
      }),
    onSuccess: () => {
      toast.success("Sequência salva");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["sequences"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Sequência excluída");
      qc.invalidateQueries({ queryKey: ["sequences"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing({ name: "", description: "", active: true });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Workflow}
        title="Sequências"
        subtitle="Cadências multi-passo para outreach. Ao matricular um contato, atividades são criadas automaticamente."
        action={canManage ? (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Nova sequência
          </Button>
        ) : undefined}
      />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : (data?.sequences ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <Workflow className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">Nenhuma sequência criada ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(data?.sequences ?? []).map((s) => (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Link to="/sequences/$id" params={{ id: s.id }} className="font-semibold hover:underline truncate">
                        {s.name}
                      </Link>
                      {s.active ? (
                        <Badge variant="default" className="text-[10px]">Ativa</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Inativa</Badge>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{s.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" /> {s.step_count} passos</span>
                      <span className="flex items-center gap-1"><UsersIcon className="h-3 w-3" /> {s.active_enrollments} ativos</span>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing({
                            id: s.id,
                            name: s.name,
                            description: s.description ?? "",
                            active: s.active,
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Excluir "${s.name}"?`)) remove.mutate(s.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar sequência" : "Nova sequência"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="active"
                checked={editing.active}
                onCheckedChange={(c) => setEditing({ ...editing, active: c })}
              />
              <Label htmlFor="active">Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!editing.name.trim() || upsert.isPending} onClick={() => upsert.mutate()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
