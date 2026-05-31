import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Printer, ArrowLeft, Save, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  getProposal, updateProposal, deleteProposal, upsertItem, deleteItem,
} from "@/lib/proposals.functions";

export const Route = createFileRoute("/_app/proposals/$id")({ component: ProposalDetail });

const BRL = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

type Product = { id: string; name: string; unit_price: number; sku: string | null };

function ProposalDetail() {
  const { id } = Route.useParams();
  const { orgId } = useCurrentOrg();
  const nav = useNavigate();
  const qc = useQueryClient();
  const get = useServerFn(getProposal);
  const upd = useServerFn(updateProposal);
  const del = useServerFn(deleteProposal);
  const upsertI = useServerFn(upsertItem);
  const delI = useServerFn(deleteItem);

  const { data, isLoading } = useQuery({
    queryKey: ["proposal", id],
    queryFn: () => get({ data: { id } }),
    refetchOnWindowFocus: false,
  });

  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    if (!orgId) return;
    supabase.from("products").select("id, name, unit_price, sku")
      .eq("organization_id", orgId).eq("active", true).order("name")
      .then(({ data: rows }) => setProducts((rows ?? []) as Product[]));
  }, [orgId]);

  const [draft, setDraft] = useState({
    title: "", status: "draft", valid_until: "", notes: "", discount_percent: 0,
  });
  useEffect(() => {
    if (data?.proposal) {
      const p: any = data.proposal;
      setDraft({
        title: p.title ?? "", status: p.status ?? "draft",
        valid_until: p.valid_until ?? "", notes: p.notes ?? "",
        discount_percent: Number(p.discount_percent ?? 0),
      });
    }
  }, [data?.proposal]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["proposal", id] });

  const save = async () => {
    try {
      await upd({ data: {
        id, title: draft.title, status: draft.status as any,
        valid_until: draft.valid_until || null, notes: draft.notes || null,
        discount_percent: Number(draft.discount_percent),
      }});
      toast.success("Salvo");
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const removeProposal = async () => {
    if (!confirm("Excluir esta proposta?")) return;
    try { await del({ data: { id } }); nav({ to: "/proposals" }); }
    catch (e: any) { toast.error(e.message); }
  };

  const addLine = async (productId?: string) => {
    if (!orgId || !data) return;
    const product = productId ? products.find((p) => p.id === productId) : undefined;
    try {
      await upsertI({ data: {
        proposal_id: id, organization_id: orgId,
        product_id: product?.id ?? null,
        description: product?.name ?? "Novo item",
        quantity: 1, unit_price: Number(product?.unit_price ?? 0),
        discount_percent: 0, sort_order: (data.items?.length ?? 0),
      }});
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const updateLine = async (item: any, patch: Partial<any>) => {
    if (!orgId) return;
    try {
      await upsertI({ data: {
        id: item.id, proposal_id: id, organization_id: orgId,
        product_id: item.product_id, description: patch.description ?? item.description,
        quantity: Number(patch.quantity ?? item.quantity),
        unit_price: Number(patch.unit_price ?? item.unit_price),
        discount_percent: Number(patch.discount_percent ?? item.discount_percent),
        sort_order: item.sort_order ?? 0,
      }});
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const removeLine = async (lineId: string) => {
    try { await delI({ data: { id: lineId, proposal_id: id } }); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (isLoading || !data?.proposal) return <div className="p-6"><Skeleton className="h-96" /></div>;
  const p: any = data.proposal;

  return (
    <div className="space-y-6 p-6 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/proposals"><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Link>
        </Button>
        <div className="flex gap-2">
          {p.share_token && (
            <Button variant="outline" onClick={() => {
              const url = `${window.location.origin}/p/${p.share_token}`;
              navigator.clipboard.writeText(url).then(() => toast.success("Link público copiado"));
            }}><Link2 className="mr-1 h-4 w-4" />Copiar link público</Button>
          )}
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Imprimir / PDF</Button>
          <Button variant="outline" onClick={removeProposal}><Trash2 className="mr-1 h-4 w-4" />Excluir</Button>
          <Button onClick={save}><Save className="mr-1 h-4 w-4" />Salvar</Button>
        </div>
      </div>

      <PageHeader
        title={draft.title || "Proposta"}
        subtitle={p.companies?.name ?? p.contacts?.name ?? "Cliente não vinculado"}
        action={<Badge>{draft.status}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-4 print:hidden">
        <div className="md:col-span-2">
          <Label>Título</Label>
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="sent">Enviada</SelectItem>
              <SelectItem value="accepted">Aceita</SelectItem>
              <SelectItem value="rejected">Recusada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Válida até</Label>
          <Input type="date" value={draft.valid_until ?? ""} onChange={(e) => setDraft({ ...draft, valid_until: e.target.value })} />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b p-4 print:hidden">
          <div className="text-sm font-medium">Itens</div>
          <div className="flex items-center gap-2">
            <Select onValueChange={(v) => addLine(v)}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Adicionar produto..." /></SelectTrigger>
              <SelectContent>
                {products.map((pr) => (
                  <SelectItem key={pr.id} value={pr.id}>
                    {pr.name} — {BRL(pr.unit_price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => addLine()}><Plus className="mr-1 h-3 w-3" />Item livre</Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-24 text-right">Qtd</TableHead>
              <TableHead className="w-32 text-right">Preço unit.</TableHead>
              <TableHead className="w-24 text-right">Desc %</TableHead>
              <TableHead className="w-32 text-right">Subtotal</TableHead>
              <TableHead className="w-12 print:hidden" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((it: any) => {
              const line = Number(it.quantity) * Number(it.unit_price);
              const sub = line * (1 - Number(it.discount_percent) / 100);
              return (
                <TableRow key={it.id}>
                  <TableCell>
                    <Input className="print:border-0 print:bg-transparent print:p-0" defaultValue={it.description}
                      onBlur={(e) => e.target.value !== it.description && updateLine(it, { description: e.target.value })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input type="number" step="0.01" className="text-right print:border-0 print:bg-transparent print:p-0" defaultValue={it.quantity}
                      onBlur={(e) => Number(e.target.value) !== Number(it.quantity) && updateLine(it, { quantity: Number(e.target.value) })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input type="number" step="0.01" className="text-right print:border-0 print:bg-transparent print:p-0" defaultValue={it.unit_price}
                      onBlur={(e) => Number(e.target.value) !== Number(it.unit_price) && updateLine(it, { unit_price: Number(e.target.value) })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input type="number" step="0.01" className="text-right print:border-0 print:bg-transparent print:p-0" defaultValue={it.discount_percent}
                      onBlur={(e) => Number(e.target.value) !== Number(it.discount_percent) && updateLine(it, { discount_percent: Number(e.target.value) })} />
                  </TableCell>
                  <TableCell className="text-right font-medium">{BRL(sub)}</TableCell>
                  <TableCell className="print:hidden">
                    <Button size="sm" variant="ghost" onClick={() => removeLine(it.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2 p-4">
          <Label>Observações / Termos</Label>
          <Textarea rows={6} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{BRL(p.subtotal ?? 0)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Desconto global %</span>
            <Input className="w-24 text-right print:border-0 print:bg-transparent print:p-0" type="number" step="0.01"
              value={draft.discount_percent}
              onChange={(e) => setDraft({ ...draft, discount_percent: Number(e.target.value) })}
              onBlur={save} />
          </div>
          <div className="mt-4 flex items-center justify-between border-t pt-3 text-lg font-semibold">
            <span>Total</span>
            <span>{BRL(p.total ?? 0)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
