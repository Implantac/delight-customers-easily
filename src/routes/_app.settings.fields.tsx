import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Plus, Trash2, Sliders } from "lucide-react";
import { toast } from "sonner";
import type { CustomFieldEntity, CustomFieldKind } from "@/lib/custom-fields";

export const Route = createFileRoute("/_app/settings/fields")({ component: FieldsSettings });

const ENTITIES: { value: CustomFieldEntity; label: string }[] = [
  { value: "contact", label: "Contatos" },
  { value: "company", label: "Empresas" },
  { value: "deal", label: "Oportunidades" },
];

const KINDS: { value: CustomFieldKind; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "select", label: "Seleção" },
  { value: "boolean", label: "Sim/Não" },
];

function FieldsSettings() {
  const { orgId, role } = useCurrentOrg();
  const qc = useQueryClient();
  const [tab, setTab] = useState<CustomFieldEntity>("contact");
  const isAdmin = role === "owner" || role === "admin";

  const { data: fields } = useQuery({
    queryKey: ["custom-fields-all"],
    enabled: !!orgId,
    queryFn: async () => (await supabase.from("custom_field_defs").select("*").order("position")).data ?? [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_field_defs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["custom-fields-all"] }); qc.invalidateQueries({ queryKey: ["custom-fields"] }); toast.success("Campo removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  const list = (fields ?? []).filter((f: any) => f.entity === tab);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <PageHeader title="Campos personalizados" subtitle="Adicione campos extras aos seus registros" />

      <Tabs value={tab} onValueChange={(v) => setTab(v as CustomFieldEntity)}>
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            {ENTITIES.map((e) => <TabsTrigger key={e.value} value={e.value}>{e.label}</TabsTrigger>)}
          </TabsList>
          {isAdmin && <NewFieldDialog entity={tab} onCreated={() => qc.invalidateQueries({ queryKey: ["custom-fields-all"] })} />}
        </div>

        {ENTITIES.map((e) => (
          <TabsContent key={e.value} value={e.value} className="mt-4">
            <Card className="divide-y">
              {list.length === 0 ? (
                <EmptyState icon={Sliders} title="Nenhum campo personalizado" description="Adicione campos extras para guardar informações específicas do seu negócio." />
              ) : list.map((f: any) => (
                <div key={f.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{f.label}</p>
                    <p className="text-xs text-muted-foreground">chave: <code>{f.key}</code> · {KINDS.find((k) => k.value === f.kind)?.label}</p>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => del.mutate(f.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function NewFieldDialog({ entity, onCreated }: { entity: CustomFieldEntity; onCreated: () => void }) {
  const { orgId } = useCurrentOrg();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<CustomFieldKind>("text");
  const [options, setOptions] = useState("");

  const submit = async () => {
    if (!orgId || !label.trim()) return toast.error("Informe um rótulo");
    const key = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const opts = kind === "select" ? options.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const { error } = await supabase.from("custom_field_defs").insert({
      organization_id: orgId, entity, key, label: label.trim(), kind, options: opts as any,
    });
    if (error) return toast.error(error.message);
    toast.success("Campo criado");
    setLabel(""); setOptions(""); setKind("text"); setOpen(false); onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo campo</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo campo personalizado</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Rótulo</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: LinkedIn" />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as CustomFieldKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {kind === "select" && (
            <div className="space-y-1.5">
              <Label>Opções (separadas por vírgula)</Label>
              <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Quente, Morno, Frio" />
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={submit}>Criar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
