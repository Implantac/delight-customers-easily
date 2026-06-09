import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
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
import { Plus, Globe, Trash2, Building2, Download, X, Search, Layers, FileText, Link2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { companySchema, fromForm } from "@/lib/validation";
import { CompanyDuplicateWarning } from "@/components/duplicate-warning";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { SavedViews } from "@/components/saved-views";
import { CnpjSearch } from "@/components/cnpj-search";

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
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("");
  
  const formRef = useRef<HTMLFormElement>(null);

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
  const bulkDel = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("companies").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ["companies"] }); setSelected(new Set()); toast.success(`${n} empresas removidas`); },
    onError: (e: any) => toast.error(e.message),
  });


  const handleCnpjSuccess = (data: any) => {
    if (formRef.current) {
      const nameInput = formRef.current.elements.namedItem("name") as HTMLInputElement;
      const industryInput = formRef.current.elements.namedItem("industry") as HTMLInputElement;
      const notesInput = formRef.current.elements.namedItem("notes") as HTMLTextAreaElement;

      if (nameInput) nameInput.value = data.nome_fantasia || data.razao_social;
      if (industryInput) industryInput.value = data.cnae_fiscal_descricao || "";
      if (notesInput) notesInput.value = `CNPJ: ${data.cnpj}\nMunicípio: ${data.municipio} - ${data.uf}\nE-mail: ${data.email || "N/A"}`;
      
      setDupName(data.nome_fantasia || data.razao_social);
    }
  };

  const list = companies ?? [];
  const kpi = {
    total: list.length,
    industries: new Set(list.map((c) => (c.industry ?? "").trim()).filter(Boolean)).size,
    withSite: list.filter((c) => !!c.website).length,
    withNotes: list.filter((c) => !!c.notes).length,
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Empresas"
        subtitle="Sua carteira B2B — quem você atende, em que setor e onde mora o contexto comercial."
        icon={Building2}
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
            <DialogTrigger asChild><Button className="bg-primary hover:scale-105 transition-transform"><Plus className="mr-2 h-4 w-4" />Nova empresa</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-display font-bold">Cadastrar Nova Empresa</DialogTitle>
              </DialogHeader>
              
              <div className="py-4 border-b border-border/50 mb-4">
                <CnpjSearch onSuccess={handleCnpjSuccess} />
              </div>

              <form ref={formRef} onSubmit={(e) => { e.preventDefault(); create.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Nome ou Razão Social *</Label><Input name="name" required maxLength={150} onChange={(e) => setDupName(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Website</Label><Input name="website" maxLength={255} placeholder="https://…" onChange={(e) => setDupSite(e.target.value)} /></div>
                </div>
                <CompanyDuplicateWarning name={dupName} website={dupSite} />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Indústria / Setor</Label><Input name="industry" maxLength={120} /></div>
                  <div className="space-y-1.5"><Label>Tamanho (Funcionários)</Label><Input name="size" maxLength={50} placeholder="1-10, 11-50…" /></div>
                </div>
                <div className="space-y-1.5"><Label>Notas & Contexto</Label><Textarea name="notes" maxLength={1000} className="min-h-[100px]" /></div>
                <DialogFooter className="gap-2">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={create.isPending} className="px-8 font-bold">
                    <Sparkles className="mr-2 h-4 w-4" /> Criar Empresa
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCell label="Empresas" value={kpi.total} icon={Building2} loading={isLoading} />
        <KpiCell label="Setores distintos" value={kpi.industries} icon={Layers} loading={isLoading} tone="primary" />
        <KpiCell label="Com website" value={kpi.withSite} icon={Link2} loading={isLoading} />
        <KpiCell label="Com contexto" value={kpi.withNotes} icon={FileText} loading={isLoading} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar empresas…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Input
          placeholder="Indústria"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="w-full sm:w-48"
        />
        <SavedViews
          entity="companies"
          currentFilters={{ search, industry }}
          onApply={(f: Record<string, unknown>) => {
            setSearch((f.search as string) ?? "");
            setIndustry((f.industry as string) ?? "");
          }}
        />
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-md border bg-accent/40 px-3 py-2 text-sm">
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

      {(() => {
        const filtered = (companies ?? []).filter((c) =>
          (!search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.website ?? "").toLowerCase().includes(search.toLowerCase())) &&
          (!industry || (c.industry ?? "").toLowerCase().includes(industry.toLowerCase()))
        );
        return isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6"><EmptyState icon={Building2} title="Nenhuma empresa" description={search || industry ? "Nenhum resultado para esses filtros." : "Cadastre sua primeira empresa para começar."} /></div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
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
      );
      })()}
    </div>
  );
}

function KpiCell({
  label, value, icon: Icon, tone, loading,
}: {
  label: string; value: number; icon: any;
  tone?: "primary" | "ok" | "danger"; loading?: boolean;
}) {
  const color =
    tone === "danger" ? "text-destructive"
    : tone === "ok" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "primary" ? "text-primary"
    : "text-foreground";
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      {loading ? <Skeleton className="h-6 w-16 mt-1" /> : (
        <div className={`text-2xl font-semibold mt-1 tracking-tight ${color}`}>{value}</div>
      )}
    </Card>
  );
}
