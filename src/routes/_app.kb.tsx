import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Plus, Search, Eye, Pencil, Trash2 } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { listArticles, upsertArticle, deleteArticle } from "@/lib/kb.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/kb")({
  component: KbPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  published: "default",
  archived: "secondary",
};

function KbPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const list = useServerFn(listArticles);
  const upsert = useServerFn(upsertArticle);
  const del = useServerFn(deleteArticle);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "published" | "archived">("all");
  const [category, setCategory] = useState<string>("__all__");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "",
    tags: "",
    status: "draft" as "draft" | "published" | "archived",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["kb", orgId, search, status, category],
    queryFn: () =>
      list({
        data: {
          organization_id: orgId!,
          search: search || undefined,
          status,
          category: category === "__all__" ? undefined : category,
        },
      }),
    enabled: !!orgId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["kb", orgId] });

  const openCreate = () => {
    setEditId(null);
    setForm({ title: "", content: "", category: "", tags: "", status: "draft" });
    setOpen(true);
  };

  const openEdit = (a: any) => {
    setEditId(a.id);
    setForm({
      title: a.title,
      content: a.content ?? "",
      category: a.category ?? "",
      tags: (a.tags ?? []).join(", "),
      status: a.status,
    });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: editId ?? undefined,
          organization_id: orgId!,
          title: form.title,
          content: form.content,
          category: form.category || null,
          tags: form.tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          status: form.status,
        },
      }),
    onSuccess: () => {
      toast.success(editId ? "Artigo atualizado" : "Artigo criado");
      setOpen(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id, organization_id: orgId! } }),
    onSuccess: () => {
      toast.success("Artigo removido");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const articles = data?.articles ?? [];
  const categories = data?.categories ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Base de Conhecimento</h1>
          <p className="text-sm text-muted-foreground">
            Documente processos, playbooks e respostas frequentes da equipe.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo artigo
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar artigos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="published">Publicados</TabsTrigger>
          <TabsTrigger value="draft">Rascunhos</TabsTrigger>
          <TabsTrigger value="archived">Arquivados</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> {articles.length} artigos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : articles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum artigo encontrado.
            </p>
          ) : (
            <div className="divide-y">
              {articles.map((a) => (
                <div key={a.id} className="flex items-start gap-4 py-4">
                  <div className="flex-1 min-w-0">
                    <Link
                      to="/kb/$id"
                      params={{ id: a.id }}
                      className="font-medium hover:underline"
                    >
                      {a.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant={STATUS_VARIANT[a.status]} className="text-xs">
                        {STATUS_LABEL[a.status]}
                      </Badge>
                      {a.category && (
                        <Badge variant="outline" className="text-xs">
                          {a.category}
                        </Badge>
                      )}
                      {(a.tags ?? []).slice(0, 3).map((t: string) => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          #{t}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {a.views}
                      </span>
                      <span>
                        atualizado{" "}
                        {formatDistanceToNow(new Date(a.updated_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(a)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Excluir "${a.title}"?`)) delMut.mutate(a.id);
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar artigo" : "Novo artigo"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Vendas, Onboarding..."
                  maxLength={80}
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="archived">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Tags (separadas por vírgula)</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="objeção, preço, demo"
              />
            </div>
            <div className="grid gap-2">
              <Label>Conteúdo (markdown)</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={12}
                className="font-mono text-sm"
                placeholder="# Título&#10;&#10;Conteúdo do artigo..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!form.title || saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              {editId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
