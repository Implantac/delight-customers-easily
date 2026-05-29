import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, Trash2, Download, FileIcon } from "lucide-react";
import { toast } from "sonner";

type EntityType = "contact" | "company" | "deal";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function formatSize(n: number | null | undefined) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function Attachments({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const { user } = useAuth();
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const key = ["attachments", entityType, entityId];

  const { data: items = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!orgId || !user) throw new Error("Sem organização ativa");
      if (file.size > MAX_BYTES) throw new Error("Arquivo maior que 10 MB");
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${orgId}/${entityType}/${entityId}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type || undefined });
      if (up.error) throw up.error;
      const { error } = await supabase.from("attachments").insert({
        organization_id: orgId,
        user_id: user.id,
        entity_type: entityType,
        entity_id: entityId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (error) {
        await supabase.storage.from("attachments").remove([path]);
        throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Arquivo enviado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (att: { id: string; storage_path: string }) => {
      await supabase.storage.from("attachments").remove([att.storage_path]);
      const { error } = await supabase.from("attachments").delete().eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  const open = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("attachments").createSignedUrl(path, 60);
    if (error || !data) { toast.error("Não foi possível abrir o arquivo"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Paperclip className="h-4 w-4" />Anexos ({items.length})</h3>
        <Button size="sm" variant="outline" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
          <Upload className="mr-1 h-4 w-4" />{upload.isPending ? "Enviando…" : "Enviar"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = "";
          }}
        />
      </div>
      <div className="mt-3 space-y-1.5">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum arquivo. Envie até 10 MB.</p>}
        {items.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
            <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{a.file_name}</p>
              <p className="text-xs text-muted-foreground">{formatSize(a.size_bytes)} · {new Date(a.created_at).toLocaleDateString("pt-BR")}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => open(a.storage_path, a.file_name)} title="Baixar"><Download className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remover arquivo?")) del.mutate({ id: a.id, storage_path: a.storage_path }); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
