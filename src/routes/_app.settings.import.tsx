import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { csvToObjects } from "@/lib/csv";

export const Route = createFileRoute("/_app/settings/import")({ component: ImportPage });

type Kind = "contacts" | "companies";

const FIELDS: Record<Kind, { key: string; label: string; required?: boolean }[]> = {
  contacts: [
    { key: "name", label: "Nome", required: true },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telefone" },
    { key: "position", label: "Cargo" },
    { key: "notes", label: "Notas" },
  ],
  companies: [
    { key: "name", label: "Nome", required: true },
    { key: "website", label: "Website" },
    { key: "industry", label: "Setor" },
    { key: "size", label: "Tamanho" },
    { key: "notes", label: "Notas" },
  ],
};

function ImportPage() {
  const [kind, setKind] = useState<Kind>("contacts");

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader title="Importar CSV" subtitle="Carregue um arquivo CSV e mapeie as colunas para os campos do CRM." />
      <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)} className="mt-6">
        <TabsList>
          <TabsTrigger value="contacts">Contatos</TabsTrigger>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
        </TabsList>
        <TabsContent value="contacts" className="mt-4"><Importer kind="contacts" /></TabsContent>
        <TabsContent value="companies" className="mt-4"><Importer kind="companies" /></TabsContent>
      </Tabs>
    </div>
  );
}

function Importer({ kind }: { kind: Kind }) {
  const { user } = useAuth();
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [filename, setFilename] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const fields = FIELDS[kind];

  const autoMap = (hs: string[]) => {
    const map: Record<string, string> = {};
    fields.forEach((f) => {
      const h = hs.find((x) => x.toLowerCase().includes(f.key.toLowerCase()) || x.toLowerCase() === f.label.toLowerCase());
      if (h) map[f.key] = h;
    });
    return map;
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    const { headers: hs, rows: rs } = csvToObjects(text);
    if (hs.length === 0) { toast.error("CSV vazio ou inválido"); return; }
    setFilename(file.name);
    setHeaders(hs);
    setRows(rs);
    setMapping(autoMap(hs));
  };

  const preview = useMemo(() => rows.slice(0, 5), [rows]);

  const ready = !!mapping.name && rows.length > 0 && !!orgId;

  const importMut = useMutation({
    mutationFn: async () => {
      if (!user || !orgId) throw new Error("Sem organização ativa");
      const payload = rows
        .map((r) => {
          const obj: Record<string, any> = { user_id: user.id, organization_id: orgId };
          fields.forEach((f) => {
            const src = mapping[f.key];
            if (!src) return;
            const v = r[src]?.trim();
            if (v) obj[f.key] = v;
          });
          return obj;
        })
        .filter((o) => typeof o.name === "string" && o.name.length > 0);
      if (payload.length === 0) throw new Error("Nenhuma linha válida (nome obrigatório)");

      // chunk inserts to be safe
      const chunkSize = 200;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const slice = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from(kind).insert(slice);
        if (error) throw error;
      }
      return payload.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: [kind] });
      toast.success(`${n} ${kind === "contacts" ? "contatos" : "empresas"} importados`);
      setFilename(null); setHeaders([]); setRows([]); setMapping({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-6">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center hover:bg-accent/40">
        <Upload className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">{filename ?? "Clique para escolher um arquivo .csv"}</p>
        <p className="text-xs text-muted-foreground">UTF-8 · vírgula como separador · primeira linha = cabeçalho</p>
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      </label>

      {headers.length > 0 && (
        <>
          <div className="mt-6">
            <h3 className="text-sm font-semibold">Mapeamento de colunas</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs">
                    {f.label} {f.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Select value={mapping[f.key] ?? "_none"} onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === "_none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Ignorar —</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />Pré-visualização ({rows.length} linhas)</h3>
            <div className="mt-3 overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>{fields.map((f) => <th key={f.key} className="px-3 py-2 text-left font-medium">{f.label}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t">
                      {fields.map((f) => {
                        const src = mapping[f.key];
                        return <td key={f.key} className="truncate px-3 py-2 max-w-[180px]">{src ? r[src] : <span className="text-muted-foreground">—</span>}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setFilename(null); setHeaders([]); setRows([]); setMapping({}); }}>Cancelar</Button>
            <Button disabled={!ready || importMut.isPending} onClick={() => importMut.mutate()}>
              {importMut.isPending ? "Importando…" : `Importar ${rows.length} linhas`}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
