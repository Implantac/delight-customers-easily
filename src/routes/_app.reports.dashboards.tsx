import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { listDashboards, createDashboard, deleteDashboard } from "@/lib/dashboards.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { LayoutDashboard, Plus, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports/dashboards")({ component: DashboardsListPage });

function DashboardsListPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const listFn = useServerFn(listDashboards);
  const createFn = useServerFn(createDashboard);
  const delFn = useServerFn(deleteDashboard);

  const q = useQuery({
    queryKey: ["dashboards", orgId],
    queryFn: () => listFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { organization_id: orgId!, name, description: desc } }),
    onSuccess: () => {
      toast.success("Dashboard criado");
      setOpen(false); setName(""); setDesc("");
      qc.invalidateQueries({ queryKey: ["dashboards", orgId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["dashboards", orgId] }); },
  });

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <PageHeader
        title="Dashboards customizáveis"
        subtitle="Crie painéis com KPIs, gráficos e listas. Cada usuário pode criar os próprios e compartilhar com a organização."
        icon={LayoutDashboard}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo dashboard</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo dashboard</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Vendas Q4" /></div>
                <div><Label>Descrição</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button disabled={!name || createMut.isPending} onClick={() => createMut.mutate()}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {q.isLoading && <Card className="p-6 text-sm text-muted-foreground">Carregando…</Card>}
      {q.data?.dashboards.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhum dashboard ainda. Crie o primeiro!
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {q.data?.dashboards.map((d: any) => (
          <Card key={d.id} className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{d.name}</div>
              {d.description && <div className="text-xs text-muted-foreground truncate">{d.description}</div>}
            </div>
            <Link to="/reports/dashboards/$id" params={{ id: d.id }}>
              <Button size="sm" variant="outline"><ArrowRight className="h-4 w-4" /></Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover?")) delMut.mutate(d.id); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
