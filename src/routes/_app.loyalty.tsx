import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Award, Plus, Trash2, Pencil, Gift, Users as UsersIcon, TrendingUp, Crown, UserPlus, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/lib/org";
import {
  listLoyalty, enrollContact, recordPoints, upsertReward, deleteReward, redeemReward,
} from "@/lib/loyalty.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/loyalty")({ component: LoyaltyPage });

const TIER_LABEL: Record<string, string> = { bronze: "Bronze", prata: "Prata", ouro: "Ouro", platina: "Platina" };
const TIER_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  bronze: "outline", prata: "secondary", ouro: "default", platina: "default",
};

function LoyaltyPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const listFn = useServerFn(listLoyalty);
  const enrollFn = useServerFn(enrollContact);
  const recordFn = useServerFn(recordPoints);
  const saveRewardFn = useServerFn(upsertReward);
  const delRewardFn = useServerFn(deleteReward);
  const redeemFn = useServerFn(redeemReward);

  const [enrollDlg, setEnrollDlg] = useState(false);
  const [enrollId, setEnrollId] = useState("");

  const [pointsDlg, setPointsDlg] = useState<any>(null);
  const [pointsDraft, setPointsDraft] = useState({ kind: "earn" as any, points: "100", reason: "", reference: "" });

  const [rewardDlg, setRewardDlg] = useState(false);
  const [rewardEditId, setRewardEditId] = useState<string | null>(null);
  const [rewardDraft, setRewardDraft] = useState({ name: "", description: "", cost_points: "500", stock: "", active: true });

  const [redeemDlg, setRedeemDlg] = useState<any>(null);
  const [redeemRewardId, setRedeemRewardId] = useState<string>("");

  const q = useQuery({
    queryKey: ["loyalty", orgId],
    queryFn: () => listFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["loyalty"] });

  const doEnroll = useMutation({
    mutationFn: async () => enrollFn({ data: { organization_id: orgId!, contact_id: enrollId.trim() } }),
    onSuccess: (r) => {
      toast.success(r.already ? "Contato já estava inscrito" : "Contato inscrito");
      setEnrollDlg(false); setEnrollId(""); invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const doPoints = useMutation({
    mutationFn: async () => recordFn({
      data: {
        organization_id: orgId!,
        account_id: pointsDlg.id,
        kind: pointsDraft.kind,
        points: parseInt(pointsDraft.points) || 0,
        reason: pointsDraft.reason || null,
        reference: pointsDraft.reference || null,
      },
    }),
    onSuccess: (r) => { toast.success(`Saldo: ${r.balance} pts · ${TIER_LABEL[r.tier]}`); setPointsDlg(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveReward = useMutation({
    mutationFn: async () => saveRewardFn({
      data: {
        id: rewardEditId ?? undefined,
        organization_id: orgId!,
        name: rewardDraft.name.trim(),
        description: rewardDraft.description || null,
        cost_points: parseInt(rewardDraft.cost_points) || 0,
        stock: rewardDraft.stock === "" ? null : parseInt(rewardDraft.stock),
        active: rewardDraft.active,
      },
    }),
    onSuccess: () => {
      toast.success("Recompensa salva");
      setRewardDlg(false); setRewardEditId(null);
      setRewardDraft({ name: "", description: "", cost_points: "500", stock: "", active: true });
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeReward = useMutation({
    mutationFn: async (id: string) => delRewardFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluída"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const doRedeem = useMutation({
    mutationFn: async () => redeemFn({
      data: { organization_id: orgId!, account_id: redeemDlg.id, reward_id: redeemRewardId },
    }),
    onSuccess: (r) => { toast.success(`${r.reward} resgatado · saldo ${r.balance}`); setRedeemDlg(null); setRedeemRewardId(""); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const accounts = q.data?.accounts ?? [];
  const rewards = q.data?.rewards ?? [];
  const txs = q.data?.transactions ?? [];
  const totals = q.data?.totals ?? { members: 0, total_balance: 0, total_earned: 0, total_redeemed: 0, by_tier: { bronze: 0, prata: 0, ouro: 0, platina: 0 } };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={Award}
        title="Programa de Fidelidade"
        subtitle="Acumule pontos por compras, premie clientes recorrentes e gerencie um catálogo de recompensas."
        action={
          <Button onClick={() => setEnrollDlg(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Inscrever contato
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><UsersIcon className="h-4 w-4" /> Membros</div>
          <div className="text-2xl font-bold mt-1">{totals.members}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Sparkles className="h-4 w-4" /> Saldo total</div>
          <div className="text-2xl font-bold mt-1">{totals.total_balance.toLocaleString("pt-BR")}</div>
          <div className="text-xs text-muted-foreground">pontos em circulação</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Acumulado</div>
          <div className="text-2xl font-bold mt-1">{totals.total_earned.toLocaleString("pt-BR")}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Gift className="h-4 w-4" /> Resgatado</div>
          <div className="text-2xl font-bold mt-1">{totals.total_redeemed.toLocaleString("pt-BR")}</div>
        </CardContent></Card>
      </div>

      <Card><CardContent className="p-4 flex flex-wrap gap-3 text-sm">
        <Badge variant="outline" className="px-3 py-1">Bronze: {totals.by_tier.bronze}</Badge>
        <Badge variant="secondary" className="px-3 py-1">Prata: {totals.by_tier.prata}</Badge>
        <Badge variant="default" className="px-3 py-1">Ouro: {totals.by_tier.ouro}</Badge>
        <Badge variant="default" className="px-3 py-1 bg-purple-600 hover:bg-purple-700">
          <Crown className="h-3 w-3 mr-1" /> Platina: {totals.by_tier.platina}
        </Badge>
      </CardContent></Card>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="rewards">Recompensas</TabsTrigger>
          <TabsTrigger value="activity">Atividade</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-2 mt-4">
          {q.isLoading ? <Skeleton className="h-64 w-full" /> :
           accounts.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">
              <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum contato inscrito ainda.</p>
            </CardContent></Card>
           ) : accounts.map((a: any) => (
            <Card key={a.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="text-center w-24 shrink-0">
                  <Badge variant={TIER_BADGE[a.tier]} className={a.tier === "platina" ? "bg-purple-600" : ""}>
                    {a.tier === "platina" && <Crown className="h-3 w-3 mr-1" />}
                    {TIER_LABEL[a.tier]}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">Contato {a.contact_id.slice(0, 8)}…</div>
                  <div className="text-xs text-muted-foreground">
                    Acumulado: {a.total_earned.toLocaleString("pt-BR")} · Resgatado: {a.total_redeemed.toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-bold">{a.balance.toLocaleString("pt-BR")}</div>
                  <div className="text-xs text-muted-foreground">pontos</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => { setPointsDlg(a); setPointsDraft({ kind: "earn", points: "100", reason: "", reference: "" }); }}>
                    <Plus className="h-3 w-3 mr-1" /> Pontos
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setRedeemDlg(a); setRedeemRewardId(""); }}>
                    <Gift className="h-3 w-3 mr-1" /> Resgatar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => { setRewardEditId(null); setRewardDraft({ name: "", description: "", cost_points: "500", stock: "", active: true }); setRewardDlg(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Nova recompensa
            </Button>
          </div>
          {rewards.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">
              <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma recompensa cadastrada.</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {rewards.map((r: any) => (
                <Card key={r.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{r.name}</div>
                      {!r.active && <Badge variant="outline">Inativa</Badge>}
                    </div>
                    {r.description && <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>}
                    <div className="flex items-center gap-2 pt-1">
                      <Badge className="text-base px-3 py-1">{r.cost_points.toLocaleString("pt-BR")} pts</Badge>
                      {r.stock !== null && <span className="text-xs text-muted-foreground">Disponível: {r.stock}</span>}
                    </div>
                    <div className="flex gap-1 pt-2">
                      <Button size="sm" variant="ghost" onClick={() => {
                        setRewardEditId(r.id);
                        setRewardDraft({
                          name: r.name, description: r.description ?? "",
                          cost_points: String(r.cost_points),
                          stock: r.stock === null ? "" : String(r.stock),
                          active: r.active,
                        });
                        setRewardDlg(true);
                      }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir recompensa?")) removeReward.mutate(r.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-2 mt-4">
          {txs.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">
              <p>Nenhuma transação registrada.</p>
            </CardContent></Card>
          ) : txs.map((t: any) => (
            <Card key={t.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <Badge variant={t.points > 0 ? "default" : "secondary"} className="w-20 justify-center">
                  {t.points > 0 ? "+" : ""}{t.points.toLocaleString("pt-BR")}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.reason || `${t.kind} de pontos`}</div>
                  <div className="text-xs text-muted-foreground">
                    Contato {t.contact_id.slice(0, 8)}… · {new Date(t.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <Badge variant="outline">{t.kind}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Enroll */}
      <Dialog open={enrollDlg} onOpenChange={setEnrollDlg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inscrever contato no programa</DialogTitle>
            <DialogDescription>Cole o ID do contato para criar uma conta de fidelidade.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>ID do contato</Label>
            <Input value={enrollId} onChange={(e) => setEnrollId(e.target.value)} placeholder="uuid" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollDlg(false)}>Cancelar</Button>
            <Button disabled={!enrollId.trim()} onClick={() => doEnroll.mutate()}>Inscrever</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Points */}
      <Dialog open={!!pointsDlg} onOpenChange={(o) => !o && setPointsDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimentar pontos</DialogTitle>
            <DialogDescription>Saldo atual: {pointsDlg?.balance.toLocaleString("pt-BR")} pts</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={pointsDraft.kind} onValueChange={(v: any) => setPointsDraft({ ...pointsDraft, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="earn">Ganhar (compra/ação)</SelectItem>
                  <SelectItem value="redeem">Resgatar manualmente</SelectItem>
                  <SelectItem value="adjust">Ajuste (positivo/negativo)</SelectItem>
                  <SelectItem value="expire">Expirar pontos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pontos</Label>
              <Input type="number" value={pointsDraft.points} onChange={(e) => setPointsDraft({ ...pointsDraft, points: e.target.value })} />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input value={pointsDraft.reason} onChange={(e) => setPointsDraft({ ...pointsDraft, reason: e.target.value })} placeholder="Compra #1234" />
            </div>
            <div>
              <Label>Referência (opcional)</Label>
              <Input value={pointsDraft.reference} onChange={(e) => setPointsDraft({ ...pointsDraft, reference: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPointsDlg(null)}>Cancelar</Button>
            <Button onClick={() => doPoints.mutate()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reward */}
      <Dialog open={rewardDlg} onOpenChange={setRewardDlg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rewardEditId ? "Editar recompensa" : "Nova recompensa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={rewardDraft.name} onChange={(e) => setRewardDraft({ ...rewardDraft, name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={rewardDraft.description} onChange={(e) => setRewardDraft({ ...rewardDraft, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Custo (pontos)</Label>
                <Input type="number" value={rewardDraft.cost_points} onChange={(e) => setRewardDraft({ ...rewardDraft, cost_points: e.target.value })} />
              </div>
              <div>
                <Label>Quantidade disponível (vazio = ilimitado)</Label>
                <Input type="number" value={rewardDraft.stock} onChange={(e) => setRewardDraft({ ...rewardDraft, stock: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={rewardDraft.active} onCheckedChange={(c) => setRewardDraft({ ...rewardDraft, active: !!c })} />
              <Label>Ativa para resgate</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRewardDlg(false)}>Cancelar</Button>
            <Button disabled={!rewardDraft.name.trim()} onClick={() => saveReward.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redeem */}
      <Dialog open={!!redeemDlg} onOpenChange={(o) => !o && setRedeemDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resgatar recompensa</DialogTitle>
            <DialogDescription>Saldo: {redeemDlg?.balance.toLocaleString("pt-BR")} pts</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Recompensa</Label>
            <Select value={redeemRewardId} onValueChange={setRedeemRewardId}>
              <SelectTrigger><SelectValue placeholder="Escolha..." /></SelectTrigger>
              <SelectContent>
                {rewards.filter((r: any) => r.active && (r.stock === null || r.stock > 0)).map((r: any) => (
                  <SelectItem key={r.id} value={r.id} disabled={r.cost_points > (redeemDlg?.balance ?? 0)}>
                    {r.name} — {r.cost_points.toLocaleString("pt-BR")} pts
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeemDlg(null)}>Cancelar</Button>
            <Button disabled={!redeemRewardId} onClick={() => doRedeem.mutate()}>Resgatar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
