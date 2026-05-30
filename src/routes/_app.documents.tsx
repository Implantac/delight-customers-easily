import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FolderPlus, Folder, FileText, Plus, Trash2, Pencil, ChevronRight, ArrowLeft, ExternalLink, History, Upload, Files, HardDrive } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import {
  listDocuments, upsertFolder, deleteFolder,
  upsertDocument, deleteDocument, addDocumentVersion, listDocumentVersions,
} from "@/lib/documents.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/documents")({ component: DocumentsPage });

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function emptyDoc() {
  return {
    name: "", description: "", url: "", mime_type: "",
    size_bytes: 0, tags: "" as string,
  };
}

function DocumentsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const listFn = useServerFn(listDocuments);
  const upsertFolderFn = useServerFn(upsertFolder);
  const delFolderFn = useServerFn(deleteFolder);
  const upsertDocFn = useServerFn(upsertDocument);
  const delDocFn = useServerFn(deleteDocument);
  const addVerFn = useServerFn(addDocumentVersion);
  const listVerFn = useServerFn(listDocumentVersions);

  const [folderId, setFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [folderDlg, setFolderDlg] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderEditId, setFolderEditId] = useState<string | null>(null);

  const [docDlg, setDocDlg] = useState(false);
  const [docDraft, setDocDraft] = useState<any>(emptyDoc());
  const [docEditId, setDocEditId] = useState<string | null>(null);

  const [verDlg, setVerDlg] = useState<any>(null);
  const [newVer, setNewVer] = useState({ url: "", size_bytes: 0, notes: "" });

  const q = useQuery({
    queryKey: ["documents", orgId, folderId, search],
    queryFn: () => listFn({ data: { organization_id: orgId!, folder_id: folderId, search: search || undefined } }),
    enabled: !!orgId,
  });

  const versionsQ = useQuery({
    queryKey: ["doc-versions", verDlg?.id],
    queryFn: () => listVerFn({ data: { document_id: verDlg.id } }),
    enabled: !!verDlg?.id,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["documents"] });

  const saveFolder = useMutation({
    mutationFn: async () => upsertFolderFn({
      data: {
        id: folderEditId ?? undefined,
        organization_id: orgId!,
        name: folderName.trim(),
        parent_id: folderId,
      },
    }),
    onSuccess: () => { toast.success("Pasta salva"); setFolderDlg(false); setFolderName(""); setFolderEditId(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeFolder = useMutation({
    mutationFn: async (id: string) => delFolderFn({ data: { id } }),
    onSuccess: () => { toast.success("Pasta excluída"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveDoc = useMutation({
    mutationFn: async () => upsertDocFn({
      data: {
        id: docEditId ?? undefined,
        organization_id: orgId!,
        folder_id: folderId,
        name: docDraft.name.trim(),
        description: docDraft.description || null,
        url: docDraft.url.trim(),
        mime_type: docDraft.mime_type || null,
        size_bytes: Number(docDraft.size_bytes) || 0,
        tags: docDraft.tags ? docDraft.tags.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      },
    }),
    onSuccess: () => { toast.success("Documento salvo"); setDocDlg(false); setDocDraft(emptyDoc()); setDocEditId(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeDoc = useMutation({
    mutationFn: async (id: string) => delDocFn({ data: { id } }),
    onSuccess: () => { toast.success("Documento excluído"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const pushVersion = useMutation({
    mutationFn: async () => addVerFn({
      data: {
        document_id: verDlg.id,
        organization_id: orgId!,
        url: newVer.url.trim(),
        size_bytes: Number(newVer.size_bytes) || 0,
        notes: newVer.notes || null,
      },
    }),
    onSuccess: () => {
      toast.success("Nova versão registrada");
      setNewVer({ url: "", size_bytes: 0, notes: "" });
      qc.invalidateQueries({ queryKey: ["doc-versions"] });
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const allFolders = q.data?.folders ?? [];
  const childFolders = allFolders.filter((f: any) => (f.parent_id ?? null) === folderId);
  const docs = q.data?.documents ?? [];
  const totals = q.data?.totals ?? { documents: 0, total_size: 0, folders: 0 };
  const currentFolder = folderId ? allFolders.find((f: any) => f.id === folderId) : null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Files className="h-7 w-7" /> Biblioteca de Documentos
          </h1>
          <p className="text-muted-foreground mt-1">
            Organize arquivos por pastas, controle versões e mantenha tudo acessível à equipe.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setFolderEditId(null); setFolderName(""); setFolderDlg(true); }}>
            <FolderPlus className="h-4 w-4 mr-2" /> Nova pasta
          </Button>
          <Button onClick={() => { setDocEditId(null); setDocDraft(emptyDoc()); setDocDlg(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo documento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Folder className="h-4 w-4" /> Pastas</div>
          <div className="text-2xl font-bold mt-1">{(allFolders ?? []).length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><FileText className="h-4 w-4" /> Documentos (aqui)</div>
          <div className="text-2xl font-bold mt-1">{totals.documents}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><HardDrive className="h-4 w-4" /> Tamanho total</div>
          <div className="text-2xl font-bold mt-1">{formatBytes(totals.total_size)}</div>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" onClick={() => setFolderId(null)} className="px-2">
          <Folder className="h-4 w-4 mr-1" /> Raiz
        </Button>
        {currentFolder && <><ChevronRight className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{currentFolder.name}</span></>}
        <div className="ml-auto">
          <Input placeholder="Buscar nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        </div>
      </div>

      {folderId && (
        <Button variant="outline" size="sm" onClick={() => setFolderId(currentFolder?.parent_id ?? null)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      )}

      {q.isLoading ? (
        <div className="space-y-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
      ) : (
        <div className="space-y-4">
          {childFolders.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {childFolders.map((f: any) => (
                <Card key={f.id} className="hover:shadow-md transition cursor-pointer group">
                  <CardContent className="p-4 flex items-center gap-3">
                    <button className="flex items-center gap-3 flex-1 text-left" onClick={() => setFolderId(f.id)}>
                      <Folder className="h-8 w-8 text-primary" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{f.name}</div>
                        <div className="text-xs text-muted-foreground">Abrir pasta</div>
                      </div>
                    </button>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setFolderEditId(f.id); setFolderName(f.name); setFolderDlg(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if (confirm("Excluir pasta?")) removeFolder.mutate(f.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {docs.length === 0 && childFolders.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum documento nesta pasta.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {docs.map((d: any) => (
                <Card key={d.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{d.name}</span>
                        <Badge variant="outline">v{d.version}</Badge>
                        {(d.tags ?? []).map((t: string) => (
                          <Badge key={t} variant="secondary">{t}</Badge>
                        ))}
                      </div>
                      {d.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{d.description}</p>}
                      <div className="text-xs text-muted-foreground mt-1">
                        {d.mime_type ?? "arquivo"} · {formatBytes(d.size_bytes ?? 0)} · atualizado {new Date(d.updated_at).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <a href={d.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setVerDlg(d)}>
                        <History className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        setDocEditId(d.id);
                        setDocDraft({
                          name: d.name, description: d.description ?? "", url: d.url,
                          mime_type: d.mime_type ?? "", size_bytes: d.size_bytes ?? 0,
                          tags: (d.tags ?? []).join(", "),
                        });
                        setDocDlg(true);
                      }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir documento?")) removeDoc.mutate(d.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Folder dialog */}
      <Dialog open={folderDlg} onOpenChange={setFolderDlg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{folderEditId ? "Editar pasta" : "Nova pasta"}</DialogTitle>
            <DialogDescription>{currentFolder ? `Dentro de "${currentFolder.name}"` : "Na raiz da biblioteca"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="Ex.: Contratos 2026" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDlg(false)}>Cancelar</Button>
            <Button disabled={!folderName.trim()} onClick={() => saveFolder.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document dialog */}
      <Dialog open={docDlg} onOpenChange={setDocDlg}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{docEditId ? "Editar documento" : "Novo documento"}</DialogTitle>
            <DialogDescription>
              Cadastre a URL onde o arquivo está hospedado (Drive, S3, link público).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={docDraft.name} onChange={(e) => setDocDraft({ ...docDraft, name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={docDraft.description} onChange={(e) => setDocDraft({ ...docDraft, description: e.target.value })} />
            </div>
            <div>
              <Label>URL do arquivo</Label>
              <Input value={docDraft.url} onChange={(e) => setDocDraft({ ...docDraft, url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo (MIME)</Label>
                <Input value={docDraft.mime_type} onChange={(e) => setDocDraft({ ...docDraft, mime_type: e.target.value })} placeholder="application/pdf" />
              </div>
              <div>
                <Label>Tamanho (bytes)</Label>
                <Input type="number" value={docDraft.size_bytes} onChange={(e) => setDocDraft({ ...docDraft, size_bytes: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={docDraft.tags} onChange={(e) => setDocDraft({ ...docDraft, tags: e.target.value })} placeholder="contrato, 2026, cliente" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDlg(false)}>Cancelar</Button>
            <Button disabled={!docDraft.name.trim() || !docDraft.url.trim()} onClick={() => saveDoc.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Versions dialog */}
      <Dialog open={!!verDlg} onOpenChange={(o) => !o && setVerDlg(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico — {verDlg?.name}</DialogTitle>
            <DialogDescription>Versão atual: v{verDlg?.version}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> Subir nova versão</div>
                <Input placeholder="Nova URL do arquivo" value={newVer.url} onChange={(e) => setNewVer({ ...newVer, url: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="Tamanho (bytes)" value={newVer.size_bytes} onChange={(e) => setNewVer({ ...newVer, size_bytes: Number(e.target.value) })} />
                  <Input placeholder="Notas (changelog)" value={newVer.notes} onChange={(e) => setNewVer({ ...newVer, notes: e.target.value })} />
                </div>
                <Button size="sm" disabled={!newVer.url.trim()} onClick={() => pushVersion.mutate()}>
                  Registrar v{(verDlg?.version ?? 1) + 1}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-2 max-h-64 overflow-auto">
              {versionsQ.data?.versions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma versão anterior registrada.</p>
              )}
              {versionsQ.data?.versions.map((v: any) => (
                <div key={v.id} className="flex items-center gap-3 p-2 border rounded">
                  <Badge variant="outline">v{v.version}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{v.notes || "Sem notas"}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(v.size_bytes ?? 0)} · {new Date(v.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" asChild>
                    <a href={v.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
