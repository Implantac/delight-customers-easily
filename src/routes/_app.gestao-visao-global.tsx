import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Users, MapPin, TrendingUp, AlertTriangle, ArrowRight } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { RequireManager } from "@/components/require-manager";

export const Route = createFileRoute("/_app/gestao-visao-global")({
  component: () => (
    <RequireManager>
      <GlobalViewPage />
    </RequireManager>
  ),
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function GlobalViewPage() {
  const { orgId } = useCurrentOrg();

  const regions = useQuery({
    queryKey: ["global-regions", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, state, city, last_purchase_at")
        .eq("organization_id", orgId!)
        .limit(2000);
      const byState = new Map<string, { state: string; total: number; active: number; cities: Set<string> }>();
      const now = Date.now();
      for (const c of (data ?? []) as any[]) {
        const s = c.state ?? "—";
        if (!byState.has(s)) byState.set(s, { state: s, total: 0, active: 0, cities: new Set() });
        const r = byState.get(s)!;
        r.total++;
        if (c.city) r.cities.add(c.city);
        if (c.last_purchase_at && now - new Date(c.last_purchase_at).getTime() < 90 * 86400000) r.active++;
      }
      return Array.from(byState.values())
        .map((r) => ({ ...r, cities: r.cities.size }))
        .sort((a, b) => b.total - a.total);
    },
  });

  const reps = useQuery({
    queryKey: ["global-reps", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: members } = await supabase
        .from("memberships")
        .select("user_id, role")
        .eq("organization_id", orgId!);
      const ids = (members ?? []).map((m: any) => m.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      const { data: deals } = await supabase
        .from("deals")
        .select("user_id, value, stage")
        .eq("organization_id", orgId!)
        .in("user_id", ids);
      const wonByUser = new Map<string, number>();
      const openByUser = new Map<string, number>();
      for (const d of (deals ?? []) as any[]) {
        if (d.stage === "won") wonByUser.set(d.user_id, (wonByUser.get(d.user_id) ?? 0) + Number(d.value ?? 0));
        else if (d.stage !== "lost") openByUser.set(d.user_id, (openByUser.get(d.user_id) ?? 0) + Number(d.value ?? 0));
      }
      return (profs ?? []).map((p: any) => ({
        id: p.id,
        name: p.full_name ?? "Sem nome",
        won: wonByUser.get(p.id) ?? 0,
        open: openByUser.get(p.id) ?? 0,
      })).sort((a, b) => b.won - a.won);
    },
  });

  const risks = useQuery({
    queryKey: ["global-risks", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_churn_predictions")
        .select("company_id, risk_score, companies(name, state)")
        .eq("organization_id", orgId!)
        .gte("risk_score", 0.6)
        .order("risk_score", { ascending: false })
        .limit(20);
      return (data ?? []) as any[];
    },
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        icon={Globe}
        title="Visão Global do Gestor"
        subtitle="Mapa consolidado de cobertura, performance e riscos por região e representante"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Cobertura por estado</h3>
          </div>
          {regions.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="space-y-2">
              {(regions.data ?? []).slice(0, 12).map((r) => {
                const cov = r.total > 0 ? Math.round((r.active / r.total) * 100) : 0;
                const lowCoverage = cov < 30 && r.total >= 5;
                return (
                  <div key={r.state} className="flex items-center gap-3 rounded-md border p-2.5">
                    <div className="w-12 font-mono text-sm">{r.state}</div>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs">
                        <span>{r.total} clientes · {r.cities} cidades</span>
                        <span className={lowCoverage ? "text-rose-500 font-medium" : "text-muted-foreground"}>
                          {cov}% ativos
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 bg-muted rounded">
                        <div
                          className={lowCoverage ? "h-full rounded bg-rose-500" : "h-full rounded bg-emerald-500"}
                          style={{ width: `${cov}%` }}
                        />
                      </div>
                    </div>
                    {lowCoverage && <Badge variant="destructive">Baixa cobertura</Badge>}
                  </div>
                );
              })}
            </div>
          )}
          <Button asChild variant="ghost" size="sm" className="mt-3">
            <Link to="/geo">Ver mapa completo <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Ranking de representantes</h3>
          </div>
          {reps.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="space-y-2">
              {(reps.data ?? []).slice(0, 8).map((r, i) => (
                <div key={r.id} className="flex items-center gap-2 rounded-md border p-2.5">
                  <span className="font-mono text-xs w-5 text-muted-foreground">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Ganho {fmtBRL(r.won)} · Aberto {fmtBRL(r.open)}
                    </p>
                  </div>
                  {i === 0 && <TrendingUp className="h-4 w-4 text-emerald-500" />}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-rose-500" />
          <h3 className="font-semibold">Riscos de churn (alto) por região</h3>
        </div>
        {risks.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (risks.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente em risco alto identificado.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(risks.data ?? []).map((r: any) => (
              <Link
                key={r.company_id}
                to="/companies/$id"
                params={{ id: r.company_id }}
                className="flex items-center gap-2 rounded-md border p-2.5 hover:bg-muted/50"
              >
                <Badge variant="destructive">{Math.round(r.risk_score * 100)}%</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.companies?.name ?? "—"}</p>
                  <p className="text-[11px] text-muted-foreground">{r.companies?.state ?? "—"}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
