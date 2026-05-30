import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import {
  listInfluencers, upsertInfluencer, deleteInfluencer, type InfluencerRow,
} from "@/lib/marketing.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles, Plus, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { InfluencerMetricsPanel } from "@/components/influencer-metrics-panel";

export const Route = createFileRoute("/_app/influencers")({ component: InfluencersPage });

const PLATFORMS = ["instagram", "tiktok", "youtube", "linkedin", "other"];

function InfluencersPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const run = useServerFn(listInfluencers);
  const upsert = useServerFn(upsertInfluencer);
  const del = useServerFn(deleteInfluencer);

  const { data, isLoading } = useQuery({
    queryKey: ["influencers", orgId],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId! } }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InfluencerRow | null>(null);

  const save = useMutation({
    mutationFn: (vars: any) => upsert({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["influencers", orgId] });
      setOpen(false); setEditing(null);
      toast.success("Influenciador salvo");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["influencers", orgId] });
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Influenciadores"
        subtitle="Acompanhe o ROI de cada parceiro com link e cupom exclusivos."
        icon={Sparkles}
        action={
          <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <SheetTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Novo influenciador</Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{editing ? "Editar" : "Novo"} influenciador</SheetTitle>
              </SheetHeader>
              <InfluencerForm
                key={editing?.id ?? "new"}
                initial={editing}
                onSubmit={(v) => save.mutate({ ...v, organization_id: orgId, id: editing?.id })}
                pending={save.isPending}
              />
            </SheetContent>
          </Sheet>
        }
      />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !data?.rows.length ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhum influenciador cadastrado. Crie um para receber leads marcados com a tag <code className="text-xs">?ref=slug</code> ou cupom.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">Plataforma</th>
                <th className="text-left px-3 py-2">Slug / cupom</th>
                <th className="text-right px-3 py-2">Comissão</th>
                <th className="text-right px-3 py-2">Leads 30d</th>
                <th className="text-right px-3 py-2">Conv 30d</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name}</div>
                    {r.handle && <div className="text-xs text-muted-foreground">@{r.handle.replace(/^@/, "")}</div>}
                  </td>
                  <td className="px-3 py-2"><Badge variant="outline">{r.platform ?? "—"}</Badge></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 font-mono text-xs">
                      <span>?ref={r.slug}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(r.slug); toast.success("Slug copiado"); }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    {r.coupon_code && <div className="text-xs text-muted-foreground">cupom: {r.coupon_code}</div>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{r.commission_pct}%</td>
                  <td className="px-3 py-2 text-right">{r.leads_30d}</td>
                  <td className="px-3 py-2 text-right text-emerald-600 font-mono">{r.converted_30d}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>Editar</Button>
                      <Button size="icon" variant="ghost" disabled={remove.isPending} onClick={() => { if (confirm(`Remover ${r.name}?`)) remove.mutate(r.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function InfluencerForm({
  initial, onSubmit, pending,
}: { initial: InfluencerRow | null; onSubmit: (v: any) => void; pending: boolean; }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [handle, setHandle] = useState(initial?.handle ?? "");
  const [platform, setPlatform] = useState(initial?.platform ?? "instagram");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [coupon, setCoupon] = useState(initial?.coupon_code ?? "");
  const [pct, setPct] = useState(String(initial?.commission_pct ?? 10));
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [hero, setHero] = useState(initial?.hero_image_url ?? "");
  const [ctaText, setCtaText] = useState(initial?.cta_text ?? "");
  const [ctaUrl, setCtaUrl] = useState(initial?.cta_url ?? "");
  const [lpEnabled, setLpEnabled] = useState(initial?.lp_enabled ?? false);

  return (
    <form
      className="space-y-3 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name || !slug) { toast.error("Nome e slug são obrigatórios"); return; }
        onSubmit({
          name, handle: handle || null, platform,
          slug, coupon_code: coupon || null,
          commission_pct: Number(pct) || 0, is_active: active,
          headline: headline || null, bio: bio || null,
          hero_image_url: hero || null, cta_text: ctaText || null,
          cta_url: ctaUrl || null, lp_enabled: lpEnabled,
        });
      }}
    >
      <div className="space-y-1.5"><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5"><Label>@handle</Label><Input value={handle} onChange={(e) => setHandle(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label>Plataforma</Label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5"><Label>Slug exclusivo *</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex: maria-influ" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5"><Label>Cupom</Label><Input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="MARIA10" /></div>
        <div className="space-y-1.5"><Label>Comissão %</Label><Input type="number" value={pct} onChange={(e) => setPct(e.target.value)} min={0} max={100} /></div>
      </div>
      <div className="flex items-center justify-between rounded-md border p-3">
        <Label>Ativo</Label>
        <Switch checked={active} onCheckedChange={setActive} />
      </div>

      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-semibold">Landing page pública</Label>
            <p className="text-xs text-muted-foreground">Disponível em <code>/i/&lt;org&gt;/{slug || "slug"}</code></p>
          </div>
          <Switch checked={lpEnabled} onCheckedChange={setLpEnabled} />
        </div>
        {lpEnabled && (
          <>
            <div className="space-y-1.5"><Label>Manchete</Label><Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Use meu cupom e ganhe 10%" /></div>
            <div className="space-y-1.5"><Label>Bio / texto</Label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></div>
            <div className="space-y-1.5"><Label>Imagem de capa (URL)</Label><Input value={hero} onChange={(e) => setHero(e.target.value)} placeholder="https://..." /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Texto do botão</Label><Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Quero falar agora" /></div>
              <div className="space-y-1.5"><Label>Link extra</Label><Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://..." /></div>
            </div>
          </>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
    </form>
  );
}

