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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Plus, Mail, Phone, Trash2, Search, Users, Download, X } from "lucide-react";
import { toast } from "sonner";
import { contactSchema, fromForm } from "@/lib/validation";
import { ContactDuplicateWarning } from "@/components/duplicate-warning";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { SavedViews } from "@/components/saved-views";
import { useServerFn } from "@tanstack/react-start";
import { runAutomations } from "@/lib/automations.functions";
import { triggerWebhooks } from "@/lib/webhooks.functions";

export const Route = createFileRoute("/_app/contacts")({ component: ContactsPage });

function ContactsPage() {
  const { user } = useAuth();
  const { orgId, role } = useCurrentOrg();
  const canDelete = role === "owner" || role === "admin";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dupName, setDupName] = useState("");
  const [dupEmail, setDupEmail] = useState("");
  const [dupPhone, setDupPhone] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const bulkDel = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("contacts").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ["contacts"] }); setSelected(new Set()); toast.success(`${n} contatos removidos`); },
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!contacts?.length} onClick={() => {
              const csv = toCSV(contacts ?? [], [
                { key: "name", label: "Nome" }, { key: "email", label: "Email" }, { key: "phone", label: "Telefone" },
                { key: "position", label: "Cargo" }, { key: "notes", label: "Notas" },
              ] as any);
              downloadCSV(`contatos-${new Date().toISOString().slice(0,10)}.csv`, csv);
            }}><Download className="mr-2 h-4 w-4" />Exportar</Button>
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
          </div>
        }
      />

      <div className="mt-6 mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar contatos…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <SavedViews
          entity="contacts"
          currentFilters={{ search }}
          onApply={(f: Record<string, unknown>) => setSearch((f.search as string) ?? "")}
        />
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-md border bg-accent/40 px-3 py-2 text-sm">
          <span>{selected.size} selecionado{selected.size > 1 ? "s" : ""}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const rows = (contacts ?? []).filter((c) => selected.has(c.id));
              const csv = toCSV(rows as any, [
                { key: "name", label: "Nome" }, { key: "email", label: "Email" }, { key: "phone", label: "Telefone" },
                { key: "position", label: "Cargo" }, { key: "notes", label: "Notas" },
              ] as any);
              downloadCSV(`contatos-selecionados-${new Date().toISOString().slice(0,10)}.csv`, csv);
            }}><Download className="mr-2 h-4 w-4" />Exportar</Button>
            {canDelete && (
              <Button variant="destructive" size="sm" disabled={bulkDel.isPending} onClick={() => {
                if (confirm(`Remover ${selected.size} contato(s)?`)) bulkDel.mutate(Array.from(selected));
              }}><Trash2 className="mr-2 h-4 w-4" />Remover</Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

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
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={filtered.length > 0 && filtered.every((c) => selected.has(c.id))}
                    onCheckedChange={(v) => {
                      if (v) setSelected(new Set(filtered.map((c) => c.id)));
                      else setSelected(new Set());
                    }}
                  />
                </th>
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
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(selected);
                        if (v) next.add(c.id); else next.delete(c.id);
                        setSelected(next);
                      }}
                    />
                  </td>
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
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remover contato?")) del.mutate(c.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
