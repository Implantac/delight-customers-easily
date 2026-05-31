import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Gift, Plus, Trash2, Pencil, Check, X, DollarSign, Award, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/lib/org";
import {
  listReferralPrograms, upsertReferralProgram, deleteReferralProgram,
  listReferrals, upsertReferral, updateReferralStatus, deleteReferral,
} from "@/lib/referrals.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/referrals")({ component: ReferralsPage });

const REWARD_TYPE: Record<string, string> = { fixed: "Valor fixo", percent: "% do negócio", credit: "Crédito" };
const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente", qualified: "Qualificado", converted: "Convertido", rejected: "Rejeitado", paid: "Paga",
};
const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline", qualified: "secondary", converted: "default", rejected: "destructive", paid: "default",
};

function emptyProgram() {
  return {
    id: undefined as string | undefined,
    name: "", description: "",
    reward_type: "fixed" as "fixed" | "percent" | "credit",
    reward_value: 100,
    reward_currency: "BRL",
    status: "active" as "active" | "paused" | "ended",
    starts_at: "", ends_at: "", terms: "",
  };
}
function emptyReferral() {
  return {
    id: undefined as string | undefined,
    program_id: null as string | null,
    referrer_name: "", referrer_email: "",
    referred_name: "", referred_email: "", referred_phone: "", referred_company: "",
    notes: "",
  };
}

function ReferralsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const programsFn = useServerFn(listReferralPrograms);
  const upsertProgFn = useServerFn(upsertReferralProgram);
  const delProgFn = useServerFn(deleteReferralProgram);
  const referralsFn = useServerFn(listReferrals);
  const upsertRefFn = useServerFn(upsertReferral);
  const statusFn = useServerFn(updateReferralStatus);
  const delRefFn = useServerFn(deleteReferral);

  const [filter, setFilter] = useState<string>("all");
  const [progDlg, setProgDlg] = useState(false);
  const [progDraft, setProgDraft] = useState(emptyProgram());
  const [refDlg, setRefDlg] = useState(false);
  const [refDraft, setRefDraft] = useState(emptyReferral());

  const { data: progData, isLoading: progLoading } = useQuery({
    queryKey: ["referral-programs", orgId],
    enabled: !!orgId,
    queryFn: () => programsFn({ data: { organization_id: orgId! } }),
  });

  const { data: refData, isLoading: refLoading } = useQuery({
    queryKey: ["referrals", orgId, filter],
    enabled: !!orgId,
    queryFn: () => referralsFn({ data: { organization_id: orgId!, status: filter } }),
  });

  const upsertProg = useMutation({
    mutationFn: () => upsertProgFn({
      data: {
        id: progDraft.id,
        organization_id: orgId!,
        name: progDraft.name.trim(),
        description: progDraft.description?.trim() || null,
        reward_type: progDraft.reward_type,
        reward_value: Number(progDraft.reward_value) || 0,
        reward_currency: progDraft.reward_currency || "BRL",
        status: progDraft.status,
        starts_at: progDraft.starts_at || null,
        ends_at: progDraft.ends_at || null,
        terms: progDraft.terms?.trim() || null,
      },
    }),
    onSuccess: () => { toast.success("Programa salvo"); setProgDlg(false); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const delProg = useMutation({
    mutationFn: (id: string) => delProgFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const upsertRef = useMutation({
    mutationFn: () => upsertRefFn({
      data: {
        id: refDraft.id,
        organization_id: orgId!,
        program_id: refDraft.program_id || null,
        referrer_name: refDraft.referrer_name?.trim() || null,
        referrer_email: refDraft.referrer_email?.trim() || null,
        referred_name: refDraft.referred_name.trim(),
        referred_email: refDraft.referred_email?.trim() || null,
        referred_phone: refDraft.referred_phone?.trim() || null,
        referred_company: refDraft.referred_company?.trim() || null,
        notes: refDraft.notes?.trim() || null,
      },
    }),
    onSuccess: () => { toast.success("Indicação registrada"); setRefDlg(false); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const status = useMutation({
    mutationFn: (v: { id: string; status: any; deal_value?: number; rejected_reason?: string }) =>
      statusFn({ data: v }),
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: any) => toast.error(e.message),
  });

  const delRef = useMutation({
    mutationFn: (id: string) => delRefFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluída"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNewProg = () => { setProgDraft(emptyProgram()); setProgDlg(true); };
  const openEditProg = (p: any) => {
    setProgDraft({
      id: p.id, name: p.name, description: p.description ?? "",
      reward_type: p.reward_type, reward_value: Number(p.reward_value),
      reward_currency: p.reward_currency, status: p.status,
      starts_at: p.starts_at ?? "", ends_at: p.ends_at ?? "", terms: p.terms ?? "",
    });
    setProgDlg(true);
  };
  const openNewRef = () => { setRefDraft(emptyReferral()); setRefDlg(true); };

  const totals = refData?.totals ?? {
    pending: 0, qualified: 0, converted: 0, rejected: 0,
    reward_due: 0, reward_paid: 0, deal_value: 0,
  };
  const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Gift}
        title="Programa de Indicações"
        subtitle="Recompense quem trouxer novos clientes para você — defina programas e acompanhe conversões."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={openNewProg}><Award className="h-4 w-4 mr-1" /> Novo programa</Button>
            <Button onClick={openNewRef}><Plus className="h-4 w-4 mr-1" /> Nova indicação</Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Convertidas</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totals.converted}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Valor gerado</p>
          <p className="text-2xl font-bold">{fmtBRL(totals.deal_value)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Recompensa devida</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{fmtBRL(totals.reward_due)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Recompensa paga</p>
          <p className="text-2xl font-bold text-primary">{fmtBRL(totals.reward_paid)}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="referrals">
        <TabsList>
          <TabsTrigger value="referrals">Indicações</TabsTrigger>
          <TabsTrigger value="programs">Programas</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="space-y-3">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="qualified">Qualificadas</TabsTrigger>
              <TabsTrigger value="converted">Convertidas</TabsTrigger>
              <TabsTrigger value="paid">Pagas</TabsTrigger>
            </TabsList>
          </Tabs>

          {refLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (refData?.referrals ?? []).length === 0 ? (
            <Card><CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <Gift className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma indicação registrada.</p>
            </CardContent></Card>
          ) : (
            <Card><CardContent className="p-0">
              <div className="divide-y">
                {(refData?.referrals ?? []).map((r: any) => (
                  <div key={r.id} className="p-3 flex items-center gap-3 hover:bg-accent/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{r.referred_name}</p>
                        {r.referred_company && <span className="text-xs text-muted-foreground">— {r.referred_company}</span>}
                        <Badge variant={STATUS_BADGE[r.status]} className="text-[10px]">{STATUS_LABEL[r.status]}</Badge>
                        {r.referral_programs?.name && (
                          <Badge variant="outline" className="text-[10px]">{r.referral_programs.name}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Indicado por <strong>{r.referrer_name ?? r.referrer_email ?? "—"}</strong>
                        {r.referred_email && ` · ${r.referred_email}`}
                      </p>
                      <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                        {r.deal_value != null && <span>Negócio: {fmtBRL(Number(r.deal_value))}</span>}
                        {r.reward_amount != null && <span>Recompensa: {fmtBRL(Number(r.reward_amount))}</span>}
                        {r.notes && <span className="truncate max-w-md">"{r.notes}"</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {r.status === "pending" && (
                        <Button size="sm" variant="outline"
                          onClick={() => status.mutate({ id: r.id, status: "qualified" })}>
                          Qualificar
                        </Button>
                      )}
                      {(r.status === "pending" || r.status === "qualified") && (
                        <Button size="sm" variant="default"
                          onClick={() => {
                            const v = prompt("Valor do negócio gerado (R$):");
                            if (v == null) return;
                            status.mutate({ id: r.id, status: "converted", deal_value: Number(v) });
                          }}>
                          <Check className="h-3 w-3 mr-1" /> Converter
                        </Button>
                      )}
                      {r.status === "converted" && (
                        <Button size="sm" variant="secondary"
                          onClick={() => status.mutate({ id: r.id, status: "paid" })}>
                          <DollarSign className="h-3 w-3 mr-1" /> Marcar pago
                        </Button>
                      )}
                      {r.status === "pending" && (
                        <Button size="sm" variant="ghost"
                          onClick={() => {
                            const reason = prompt("Motivo da rejeição:") ?? "";
                            status.mutate({ id: r.id, status: "rejected", rejected_reason: reason });
                          }}>
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost"
                        onClick={() => { if (confirm("Excluir indicação?")) delRef.mutate(r.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="programs" className="space-y-3">
          {progLoading ? (
            <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : (progData?.programs ?? []).length === 0 ? (
            <Card><CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <Award className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhum programa configurado. Crie um para começar.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(progData?.programs ?? []).map((p: any) => (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{p.name}</p>
                          <Badge variant={p.status === "active" ? "default" : "outline"} className="text-[10px]">
                            {p.status === "active" ? "Ativo" : p.status === "paused" ? "Pausado" : "Encerrado"}
                          </Badge>
                        </div>
                        {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                        <div className="mt-2 flex items-center gap-3 text-sm">
                          <span className="flex items-center gap-1 text-emerald-600">
                            <Award className="h-3 w-3" /> {REWARD_TYPE[p.reward_type]}:{" "}
                            <strong>
                              {p.reward_type === "percent"
                                ? `${Number(p.reward_value)}%`
                                : fmtBRL(Number(p.reward_value))}
                            </strong>
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditProg(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => { if (confirm("Excluir programa?")) delProg.mutate(p.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Program dialog */}
      <Dialog open={progDlg} onOpenChange={setProgDlg}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{progDraft.id ? "Editar programa" : "Novo programa"}</DialogTitle>
            <DialogDescription>Defina como as indicações serão recompensadas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={progDraft.name} onChange={(e) => setProgDraft({ ...progDraft, name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={progDraft.description}
                onChange={(e) => setProgDraft({ ...progDraft, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo de recompensa</Label>
                <Select value={progDraft.reward_type}
                  onValueChange={(v: any) => setProgDraft({ ...progDraft, reward_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Valor fixo</SelectItem>
                    <SelectItem value="percent">% do negócio</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor</Label>
                <Input type="number" step="0.01" value={progDraft.reward_value}
                  onChange={(e) => setProgDraft({ ...progDraft, reward_value: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Início</Label>
                <Input type="date" value={progDraft.starts_at}
                  onChange={(e) => setProgDraft({ ...progDraft, starts_at: e.target.value })} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={progDraft.ends_at}
                  onChange={(e) => setProgDraft({ ...progDraft, ends_at: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={progDraft.status}
                onValueChange={(v: any) => setProgDraft({ ...progDraft, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="ended">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Termos & condições</Label>
              <Textarea rows={3} value={progDraft.terms}
                onChange={(e) => setProgDraft({ ...progDraft, terms: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProgDlg(false)}>Cancelar</Button>
            <Button disabled={!progDraft.name.trim() || upsertProg.isPending} onClick={() => upsertProg.mutate()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Referral dialog */}
      <Dialog open={refDlg} onOpenChange={setRefDlg}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova indicação</DialogTitle>
            <DialogDescription>Quem indicou e quem é o lead indicado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Programa</Label>
              <Select value={refDraft.program_id ?? "_none"}
                onValueChange={(v) => setRefDraft({ ...refDraft, program_id: v === "_none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Sem programa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem programa</SelectItem>
                  {(progData?.programs ?? []).filter((p: any) => p.status === "active").map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Indicado por (nome)</Label>
                <Input value={refDraft.referrer_name}
                  onChange={(e) => setRefDraft({ ...refDraft, referrer_name: e.target.value })} />
              </div>
              <div>
                <Label>Email do indicador</Label>
                <Input type="email" value={refDraft.referrer_email}
                  onChange={(e) => setRefDraft({ ...refDraft, referrer_email: e.target.value })} />
              </div>
            </div>
            <div className="border-t pt-3">
              <Label className="text-xs text-muted-foreground uppercase">Lead indicado</Label>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={refDraft.referred_name}
                onChange={(e) => setRefDraft({ ...refDraft, referred_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Email</Label>
                <Input type="email" value={refDraft.referred_email}
                  onChange={(e) => setRefDraft({ ...refDraft, referred_email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={refDraft.referred_phone}
                  onChange={(e) => setRefDraft({ ...refDraft, referred_phone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Empresa</Label>
              <Input value={refDraft.referred_company}
                onChange={(e) => setRefDraft({ ...refDraft, referred_company: e.target.value })} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea rows={2} value={refDraft.notes}
                onChange={(e) => setRefDraft({ ...refDraft, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefDlg(false)}>Cancelar</Button>
            <Button disabled={!refDraft.referred_name.trim() || upsertRef.isPending} onClick={() => upsertRef.mutate()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
