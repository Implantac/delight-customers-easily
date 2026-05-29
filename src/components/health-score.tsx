import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { computeHealthScore } from "@/lib/intelligence.functions";
import { useCurrentOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, AlertTriangle, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function HealthScore({ contactId, companyId }: { contactId?: string; companyId?: string }) {
  const { orgId } = useCurrentOrg();
  const run = useServerFn(computeHealthScore);
  const { data, isLoading } = useQuery({
    queryKey: ["health", orgId, contactId, companyId],
    enabled: !!orgId && !!(contactId || companyId),
    queryFn: () => run({ data: { organization_id: orgId!, contact_id: contactId, company_id: companyId } }),
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!data) return null;

  const cfg =
    data.level === "saudavel"
      ? { label: "Saudável", color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/30", icon: Heart }
      : data.level === "atencao"
      ? { label: "Atenção", color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/30", icon: AlertTriangle }
      : { label: "Em risco", color: "text-rose-600", bg: "bg-rose-500/10 border-rose-500/30", icon: AlertCircle };
  const Icon = cfg.icon;

  return (
    <Card className={`p-4 border ${cfg.bg}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md bg-background ${cfg.color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold">Health Score</p>
            <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${cfg.color}`}>{data.score}<span className="text-sm text-muted-foreground font-normal">/100</span></p>
        </div>
      </div>
      {data.reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {data.reasons.slice(0, 4).map((r, i) => <li key={i}>• {r}</li>)}
        </ul>
      )}
    </Card>
  );
}
