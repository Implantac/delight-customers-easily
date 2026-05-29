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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Plus, Mail, Phone, Trash2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { contactSchema, fromForm } from "@/lib/validation";
import { ContactDuplicateWarning } from "@/components/duplicate-warning";

export const Route = createFileRoute("/_app/contacts")({ component: ContactsPage });

function ContactsPage() {
  const { user } = useAuth();
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dupName, setDupName] = useState("");
  const [dupEmail, setDupEmail] = useState("");
  const [dupPhone, setDupPhone] = useState("");

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: companies } = useQuery({
    queryKey: ["companies-list"],
    queryFn: async () => (await supabase.from("companies").select("id, name").order("name")).data ?? [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts"] }); toast.success("Contato removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      if (!orgId) throw new Error("Nenhuma organização ativa");
      const v = fromForm(contactSchema, form);
      const { error } = await supabase.from("contacts").insert({
        ...v, user_id: user!.id, organization_id: orgId,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts"] }); setOpen(false); toast.success("Contato criado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = (contacts ?? []).filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Contatos"
        subtitle={`${contacts?.length ?? 0} contatos`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo contato</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo contato</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); create.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
                <div className="space-y-1.5"><Label>Nome *</Label><Input name="name" required maxLength={150} onChange={(e) => setDupName(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" maxLength={255} onChange={(e) => setDupEmail(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Telefone</Label><Input name="phone" maxLength={30} onChange={(e) => setDupPhone(e.target.value)} /></div>
                </div>
                <ContactDuplicateWarning name={dupName} email={dupEmail} phone={dupPhone} />
                <div className="space-y-1.5"><Label>Cargo</Label><Input name="position" maxLength={120} /></div>
                <div className="space-y-1.5">
                  <Label>Empresa</Label>
                  <Select name="company_id">
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>{companies?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Notas</Label><Textarea name="notes" maxLength={1000} /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Criar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mt-6 mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar contatos…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum contato" description={search ? "Tente outra busca." : "Comece criando seu primeiro contato."} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Empresa</th>
                <th className="px-4 py-3 text-left">Cargo</th>
                <th className="px-4 py-3 text-left">Contato</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link to="/contacts/$id" params={{ id: c.id }} className="hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{(c.companies as any)?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.position ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      {c.email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{c.email}</span>}
                      {c.phone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{c.phone}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remover contato?")) del.mutate(c.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}
    </div>
  );
}
