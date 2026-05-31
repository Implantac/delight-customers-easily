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
import { Plus, FileText, Search } from "lucide-react";
import { useMemo } from "react";
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
  const [status, setStatus] = useState<"all" | "draft" | "sent" | "accepted" | "rejected">("all");
  const [q, setQ] = useState("");

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

  const items: any[] = data?.items ?? [];
  const kpis = useMemo(() => {
    const k = { total: items.length, draft: 0, sent: 0, accepted: 0, rejected: 0, accepted_value: 0, open_value: 0 };
    for (const p of items) {
      k[p.status as "draft" | "sent" | "accepted" | "rejected"] = (k[p.status as "draft"] ?? 0) + 1;
      const v = Number(p.total ?? 0);
      if (p.status === "accepted") k.accepted_value += v;
      else if (p.status === "sent" || p.status === "draft") k.open_value += v;
    }
    return k;
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (!needle) return true;
      return (
        (p.title ?? "").toLowerCase().includes(needle) ||
        (p.companies?.name ?? "").toLowerCase().includes(needle) ||
        (p.contacts?.name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [items, status, q]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Propostas"
        subtitle="Gere orçamentos profissionais a partir de produtos e negócios."
        action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova proposta</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{kpis.total}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Enviadas</p><p className="text-2xl font-bold text-blue-600">{kpis.sent}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Aceitas</p><p className="text-2xl font-bold text-emerald-600">{BRL(kpis.accepted_value)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Em aberto</p><p className="text-2xl font-bold">{BRL(kpis.open_value)}</p></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "draft", "sent", "accepted", "rejected"] as const).map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
            {s === "all" ? "Todas" : s === "draft" ? "Rascunho" : s === "sent" ? "Enviadas" : s === "accepted" ? "Aceitas" : "Rejeitadas"}
          </Button>
        ))}
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar título ou cliente…" className="pl-8" />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {items.length === 0 ? "Sem propostas ainda. Crie a primeira." : "Nenhuma proposta encontrada com esses filtros."}
          </p>
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
