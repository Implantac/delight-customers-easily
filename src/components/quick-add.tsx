import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Loader2, Building2, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg } from "@/lib/org";

/**
 * QuickAdd — captura universal em 4 campos + CNPJ opcional.
 * Atalho global: tecla "q" (fora de inputs) ou botão flutuante.
 * Cria Deal + Contact + (opcional) Company em uma única submissão.
 */
export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [showCnpj, setShowCnpj] = useState(false);
  const [dealTitle, setDealTitle] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [pain, setPain] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [enriching, setEnriching] = useState(false);

  const { user } = useAuth();
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Atalho "q" global (ignora quando o foco está em input/textarea/contenteditable)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "q" && e.key !== "Q") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function reset() {
    setDealTitle(""); setContactName(""); setPhone(""); setPain("");
    setCnpj(""); setCompanyName(""); setShowCnpj(false);
  }

  async function lookupCnpj() {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) { toast.error("CNPJ deve ter 14 dígitos"); return; }
    setEnriching(true);
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (!r.ok) throw new Error("CNPJ não encontrado");
      const d = await r.json();
      const name = d.nome_fantasia || d.razao_social;
      setCompanyName(name);
      if (!dealTitle) setDealTitle(`Oportunidade — ${name}`);
      if (!phone && d.ddd_telefone_1) setPhone(d.ddd_telefone_1);
      toast.success(`Empresa encontrada: ${name}`);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao consultar CNPJ");
    } finally {
      setEnriching(false);
    }
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!orgId || !user) throw new Error("Sessão não pronta");
      const title = dealTitle.trim() || (contactName.trim() && `Oportunidade — ${contactName.trim()}`) || (companyName.trim() && `Oportunidade — ${companyName.trim()}`);
      if (!title) throw new Error("Informe ao menos o título ou o contato");

      // 1. Company (opcional, se veio via CNPJ)
      let companyId: string | null = null;
      if (companyName.trim()) {
        const { data: c, error } = await supabase.from("companies")
          .insert({ name: companyName.trim(), organization_id: orgId, user_id: user.id } as any)
          .select("id").single();
        if (error) throw error;
        companyId = c?.id ?? null;
      }

      // 2. Contact (se nome fornecido)
      let contactId: string | null = null;
      if (contactName.trim()) {
        const { data: ct, error } = await supabase.from("contacts")
          .insert({
            name: contactName.trim(),
            phone: phone.trim() || null,
            organization_id: orgId,
            user_id: user.id,
            company_id: companyId,
          } as any)
          .select("id").single();
        if (error) throw error;
        contactId = ct?.id ?? null;
      }

      // 3. Deal
      const { data: dl, error: dErr } = await supabase.from("deals")
        .insert({
          title,
          stage: "lead" as any,
          value: 0,
          notes: pain.trim() || null,
          organization_id: orgId,
          user_id: user.id,
          contact_id: contactId,
          company_id: companyId,
        })
        .select("id").single();
      if (dErr) throw dErr;
      return dl?.id as string;
    },
    onSuccess: () => {
      toast.success("Capturado! Deal criado.");
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      reset();
      setOpen(false);
      navigate({ to: "/pipeline" });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao criar"),
  });

  return (
    <>
      {/* Botão flutuante */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Captura rápida (Q)"
        className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 md:bottom-6 md:right-6 md:h-14 md:w-14"
      >
        <Zap className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Captura rápida
            </DialogTitle>
            <DialogDescription>
              4 campos. Crie um deal e o contato em segundos. Pressione <kbd className="rounded border bg-muted px-1 text-[10px]">Q</kbd> em qualquer lugar.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="qa-title">Título do negócio</Label>
              <Input id="qa-title" autoFocus value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} placeholder="Ex.: Renovação anual — Acme" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-contact">Contato</Label>
              <Input id="qa-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nome do decisor" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-phone">Telefone</Label>
              <Input id="qa-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-pain">Dor / Notas</Label>
              <Textarea id="qa-pain" value={pain} onChange={(e) => setPain(e.target.value)} placeholder="Qual problema queremos resolver?" rows={2} />
            </div>

            <button
              type="button"
              onClick={() => setShowCnpj((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${showCnpj ? "rotate-180" : ""}`} />
              Empresa por CNPJ (opcional)
            </button>

            {showCnpj && (
              <div className="space-y-2 rounded-md border border-dashed p-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" className="pl-8 h-9" />
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={lookupCnpj} disabled={enriching || cnpj.replace(/\D/g, "").length !== 14}>
                    {enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Buscar"}
                  </Button>
                </div>
                {companyName && (
                  <p className="text-xs text-muted-foreground">Empresa: <span className="font-medium text-foreground">{companyName}</span></p>
                )}
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Capturar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
