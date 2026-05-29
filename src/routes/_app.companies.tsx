import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Plus, Globe, Trash2, Building2, Download, X, Search } from "lucide-react";
import { toast } from "sonner";
import { companySchema, fromForm } from "@/lib/validation";
import { CompanyDuplicateWarning } from "@/components/duplicate-warning";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { SavedViews } from "@/components/saved-views";

export const Route = createFileRoute("/_app/companies")({ component: CompaniesPage });

function CompaniesPage() {
  const { user } = useAuth();
  const { orgId, role } = useCurrentOrg();
  const canDelete = role === "owner" || role === "admin";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dupName, setDupName] = useState("");
  const [dupSite, setDupSite] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      if (!orgId) throw new Error("Nenhuma organização ativa");
      const v = fromForm(companySchema, form);
      const { error } = await supabase.from("companies").insert({ ...v, user_id: user!.id, organization_id: orgId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["companies"] }); setOpen(false); toast.success("Empresa criada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["companies"] }); toast.success("Empresa removida"); },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDel = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("companies").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ["companies"] }); setSelected(new Set()); toast.success(`${n} empresas removidas`); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Empresas"
        subtitle={`${companies?.length ?? 0} empresas cadastradas`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!companies?.length} onClick={() => {
              const csv = toCSV(companies ?? [], [
                { key: "name", label: "Nome" }, { key: "website", label: "Website" },
                { key: "industry", label: "Indústria" }, { key: "size", label: "Tamanho" }, { key: "notes", label: "Notas" },
              ] as any);
              downloadCSV(`empresas-${new Date().toISOString().slice(0,10)}.csv`, csv);
            }}><Download className="mr-2 h-4 w-4" />Exportar</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nova empresa</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova empresa</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); create.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
                <div className="space-y-1.5"><Label>Nome *</Label><Input name="name" required maxLength={150} onChange={(e) => setDupName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Website</Label><Input name="website" maxLength={255} placeholder="https://…" onChange={(e) => setDupSite(e.target.value)} /></div>
                <CompanyDuplicateWarning name={dupName} website={dupSite} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Indústria</Label><Input name="industry" maxLength={120} /></div>
                  <div className="space-y-1.5"><Label>Tamanho</Label><Input name="size" maxLength={50} placeholder="1-10, 11-50…" /></div>
                </div>
                <div className="space-y-1.5"><Label>Notas</Label><Textarea name="notes" maxLength={1000} /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Criar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      {selected.size > 0 && (
        <div className="mt-6 mb-3 flex items-center justify-between gap-2 rounded-md border bg-accent/40 px-3 py-2 text-sm">
          <span>{selected.size} selecionada{selected.size > 1 ? "s" : ""}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const rows = (companies ?? []).filter((c) => selected.has(c.id));
              const csv = toCSV(rows as any, [
                { key: "name", label: "Nome" }, { key: "website", label: "Website" },
                { key: "industry", label: "Indústria" }, { key: "size", label: "Tamanho" }, { key: "notes", label: "Notas" },
              ] as any);
              downloadCSV(`empresas-selecionadas-${new Date().toISOString().slice(0,10)}.csv`, csv);
            }}><Download className="mr-2 h-4 w-4" />Exportar</Button>
            {canDelete && (
              <Button variant="destructive" size="sm" disabled={bulkDel.isPending} onClick={() => {
                if (confirm(`Remover ${selected.size} empresa(s)?`)) bulkDel.mutate(Array.from(selected));
              }}><Trash2 className="mr-2 h-4 w-4" />Remover</Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : (companies ?? []).length === 0 ? (
        <div className="mt-6"><EmptyState icon={Building2} title="Nenhuma empresa" description="Cadastre sua primeira empresa para começar." /></div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies?.map((c) => (
            <Card key={c.id} className={`p-5 transition hover:border-primary/40 ${selected.has(c.id) ? "ring-2 ring-primary/40" : ""}`}>
              <div className="flex items-start gap-3">
                <Checkbox
                  className="mt-1"
                  checked={selected.has(c.id)}
                  onCheckedChange={(v) => {
                    const next = new Set(selected);
                    if (v) next.add(c.id); else next.delete(c.id);
                    setSelected(next);
                  }}
                />
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link to="/companies/$id" params={{ id: c.id }} className="block truncate font-semibold hover:underline">{c.name}</Link>
                  {c.industry && <p className="text-xs text-muted-foreground">{c.industry}{c.size ? ` · ${c.size}` : ""}</p>}
                </div>
                {canDelete && (
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remover empresa?")) del.mutate(c.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {c.website && (
                <a href={c.website} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <Globe className="h-3 w-3" />{c.website}
                </a>
              )}
              {c.notes && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{c.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
