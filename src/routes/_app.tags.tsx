import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Tag as TagIcon, Plus, Trash2, GitMerge, Pencil } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/lib/org";
import { listTags, createTag, updateTag, deleteTag, mergeTags } from "@/lib/tags.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tags")({
  component: TagsPage,
});

const COLORS = [
  { v: "slate", c: "bg-slate-200 text-slate-800" },
  { v: "red", c: "bg-red-200 text-red-800" },
  { v: "orange", c: "bg-orange-200 text-orange-800" },
  { v: "amber", c: "bg-amber-200 text-amber-800" },
  { v: "yellow", c: "bg-yellow-200 text-yellow-800" },
  { v: "green", c: "bg-green-200 text-green-800" },
  { v: "teal", c: "bg-teal-200 text-teal-800" },
  { v: "blue", c: "bg-blue-200 text-blue-800" },
  { v: "indigo", c: "bg-indigo-200 text-indigo-800" },
  { v: "purple", c: "bg-purple-200 text-purple-800" },
  { v: "pink", c: "bg-pink-200 text-pink-800" },
];

const cls = (color: string) => COLORS.find((c) => c.v === color)?.c ?? COLORS[0].c;

function TagsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const list = useServerFn(listTags);
  const create = useServerFn(createTag);
  const update = useServerFn(updateTag);
  const del = useServerFn(deleteTag);
  const merge = useServerFn(mergeTags);

  const [openNew, setOpenNew] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("slate");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>("slate");
  const [mergeSrc, setMergeSrc] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["tags", orgId],
    queryFn: () => list({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tags", orgId] });

  const createMut = useMutation({
    mutationFn: () => create({ data: { organization_id: orgId!, name, color: color as any } }),
    onSuccess: () => {
      toast.success("Tag criada");
      setName("");
      setColor("slate");
      setOpenNew(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const updateMut = useMutation({
    mutationFn: () => update({ data: { id: editId!, organization_id: orgId!, name: editName, color: editColor as any } }),
    onSuccess: () => {
      toast.success("Tag atualizada");
      setEditId(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id, organization_id: orgId! } }),
    onSuccess: () => {
      toast.success("Tag removida");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const mergeMut = useMutation({
    mutationFn: () =>
      merge({
        data: {
          organization_id: orgId!,
          source_id: mergeSrc!,
          target_id: mergeTarget,
        },
      }),
    onSuccess: (res: any) => {
      toast.success(`Mesclado (${res?.merged ?? 0} vínculos transferidos)`);
      setMergeSrc(null);
      setMergeTarget("");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const tags = (data?.tags ?? []).filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        icon={TagIcon}
        title="Tags"
        subtitle="Organize contatos, empresas e negócios com etiquetas reutilizáveis."
        action={
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nova tag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova tag</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="vip, prospect, hot-lead..."
                  maxLength={40}
                />
              </div>
              <div className="grid gap-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.v}
                      type="button"
                      onClick={() => setColor(c.v)}
                      className={`h-8 w-8 rounded-full ${c.c} ${color === c.v ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                      aria-label={c.v}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
              <Button disabled={!name || createMut.isPending} onClick={() => createMut.mutate()}>
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />

      <Input
        placeholder="Buscar tag..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TagIcon className="h-5 w-5" /> {data?.tags?.length ?? 0} tags
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma tag {search ? "encontrada" : "criada ainda"}.
            </p>
          ) : (
            <div className="divide-y">
              {tags.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-3">
                  <Badge className={`${cls(t.color)} hover:${cls(t.color)} font-medium`}>
                    {t.name}
                  </Badge>
                  <div className="flex-1 text-xs text-muted-foreground">
                    {t.usage.total} uso{t.usage.total === 1 ? "" : "s"}
                    {t.usage.total > 0 && (
                      <span className="ml-2">
                        ({t.usage.contact} contatos, {t.usage.company} empresas, {t.usage.deal} negócios)
                      </span>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditId(t.id);
                      setEditName(t.name);
                      setEditColor(t.color);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setMergeSrc(t.id)}>
                    <GitMerge className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Excluir tag "${t.name}"?`)) deleteMut.mutate(t.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar tag</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={40} />
            </div>
            <div className="grid gap-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.v}
                    type="button"
                    onClick={() => setEditColor(c.v)}
                    className={`h-8 w-8 rounded-full ${c.c} ${editColor === c.v ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>Cancelar</Button>
            <Button disabled={updateMut.isPending} onClick={() => updateMut.mutate()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!mergeSrc} onOpenChange={(o) => !o && setMergeSrc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mesclar tags</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-sm text-muted-foreground">
              Todos os vínculos da tag de origem serão movidos para a tag destino, e a tag origem será excluída.
            </p>
            <div className="grid gap-2">
              <Label>Mesclar em</Label>
              <Select value={mergeTarget} onValueChange={setMergeTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a tag destino" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.tags ?? [])
                    .filter((t) => t.id !== mergeSrc)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeSrc(null)}>Cancelar</Button>
            <Button disabled={!mergeTarget || mergeMut.isPending} onClick={() => mergeMut.mutate()}>
              Mesclar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
