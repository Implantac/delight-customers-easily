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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Plus, Globe, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { companySchema, fromForm } from "@/lib/validation";
import { CompanyDuplicateWarning } from "@/components/duplicate-warning";

export const Route = createFileRoute("/_app/companies")({ component: CompaniesPage });

function CompaniesPage() {
  const { user } = useAuth();
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dupName, setDupName] = useState("");
  const [dupSite, setDupSite] = useState("");

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

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Empresas"
        subtitle={`${companies?.length ?? 0} empresas cadastradas`}
        action={
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
        }
      />

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : (companies ?? []).length === 0 ? (
        <div className="mt-6"><EmptyState icon={Building2} title="Nenhuma empresa" description="Cadastre sua primeira empresa para começar." /></div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies?.map((c) => (
            <Card key={c.id} className="p-5 transition hover:border-primary/40">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link to="/companies/$id" params={{ id: c.id }} className="block truncate font-semibold hover:underline">{c.name}</Link>
                  {c.industry && <p className="text-xs text-muted-foreground">{c.industry}{c.size ? ` · ${c.size}` : ""}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remover empresa?")) del.mutate(c.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
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
