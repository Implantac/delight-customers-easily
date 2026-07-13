import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { auditDemoData, type AuditCheck } from "@/lib/demo-audit.functions";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

export const Route = createFileRoute("/_app/settings/seed-audit")({
  component: SeedAuditPage,
});

const STATUS_META = {
  ok: { icon: CheckCircle2, cls: "text-emerald-600", badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "OK" },
  warn: { icon: AlertTriangle, cls: "text-amber-600", badge: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Atenção" },
  fail: { icon: XCircle, cls: "text-destructive", badge: "bg-destructive/10 text-destructive border-destructive/20", label: "Falha" },
} as const;

function SeedAuditPage() {
  const { orgId } = useCurrentOrg();
  const run = useServerFn(auditDemoData);
  const q = useQuery({
    queryKey: ["demo-audit", orgId],
    queryFn: () => run({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, AuditCheck[]>();
    for (const c of q.data?.checks ?? []) {
      const arr = map.get(c.screen) ?? [];
      arr.push(c);
      map.set(c.screen, arr);
    }
    return Array.from(map.entries());
  }, [q.data]);

  const s = q.data?.summary;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Auditoria de dados demo"
        subtitle="Verifica consistência dos registros (contagens mínimas, relacionamentos, campos obrigatórios e filtros) em todas as telas."
        icon={ShieldCheck}
        action={
          <Button onClick={() => q.refetch()} disabled={q.isFetching} size="sm">
            <RefreshCw className={`h-4 w-4 mr-1 ${q.isFetching ? "animate-spin" : ""}`} />
            Rodar novamente
          </Button>
        }
      />

      {q.isLoading && <Skeleton className="h-40" />}

      {s && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <SummaryCard label="Total de checks" value={s.total} tone="text-foreground" />
          <SummaryCard label="OK" value={s.ok} tone="text-emerald-600" />
          <SummaryCard label="Atenção" value={s.warn} tone="text-amber-600" />
          <SummaryCard label="Falhas" value={s.fail} tone="text-destructive" />
        </div>
      )}

      {q.isError && (
        <Card><CardContent className="pt-6 text-sm text-destructive">Erro ao rodar auditoria: {String((q.error as Error)?.message ?? q.error)}</CardContent></Card>
      )}

      <div className="space-y-4">
        {grouped.map(([screen, items]) => (
          <Card key={screen}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">Tela</h3>
                  <Link to={screen} className="text-sm text-primary hover:underline font-mono">{screen}</Link>
                </div>
                <div className="flex gap-1">
                  {(["fail", "warn", "ok"] as const).map((st) => {
                    const n = items.filter((i) => i.status === st).length;
                    if (!n) return null;
                    return <Badge key={st} variant="outline" className={STATUS_META[st].badge}>{n} {STATUS_META[st].label}</Badge>;
                  })}
                </div>
              </div>
              <ul className="divide-y">
                {items.map((c) => {
                  const meta = STATUS_META[c.status];
                  const Icon = meta.icon;
                  return (
                    <li key={c.id} className="py-2 flex items-start gap-3">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.cls}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{c.label}</div>
                        <div className="text-xs text-muted-foreground">{c.detail}</div>
                      </div>
                      <Badge variant="outline" className="shrink-0">{c.count}</Badge>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${tone}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
