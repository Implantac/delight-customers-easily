import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, FileText } from "lucide-react";
import { toast } from "sonner";
import { listProposals, createProposal } from "@/lib/proposals.functions";

export const Route = createFileRoute("/_app/proposals")({ component: ProposalsPage });

const BRL = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-600",
  accepted: "bg-emerald-500/15 text-emerald-600",
  rejected: "bg-red-500/15 text-red-600",
};

function ProposalsPage() {
  const { orgId } = useCurrentOrg();
  const nav = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listProposals);
  const create = useServerFn(createProposal);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["proposals", orgId],
    enabled: !!orgId,
    queryFn: () => list({ data: { organization_id: orgId! } }),
    refetchOnWindowFocus: false,
  });

  const onCreate = async () => {
    if (!orgId || !title.trim()) return;
    try {
      const { id } = await create({ data: { organization_id: orgId, title: title.trim() } });
      toast.success("Proposta criada");
      qc.invalidateQueries({ queryKey: ["proposals", orgId] });
      setOpen(false);
      setTitle("");
      nav({ to: "/proposals/$id", params: { id } });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Propostas"
        subtitle="Gere orçamentos profissionais a partir de produtos e negócios."
        action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova proposta</Button>}
      />

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (data?.items.length ?? 0) === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Sem propostas ainda. Crie a primeira.</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Válida até</TableHead>
                <TableHead className="text-right">Atualizada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.items.map((p: any) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => nav({ to: "/proposals/$id", params: { id: p.id } })}>
                  <TableCell className="font-medium">
                    <Link to="/proposals/$id" params={{ id: p.id }} className="hover:underline">{p.title}</Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.companies?.name ?? p.contacts?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_TONE[p.status] ?? STATUS_TONE.draft}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{BRL(p.total ?? 0)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {p.valid_until ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Date(p.updated_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova proposta</DialogTitle></DialogHeader>
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Proposta comercial — Cliente X" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={onCreate}>Criar e editar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
