import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { computeHealthScore } from "@/lib/intelligence.functions";
import { useCurrentOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
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

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data) return null;

  const cfg =
    data.level === "saudavel"
      ? {
          label: "Saudável",
          stroke: "oklch(0.65 0.16 155)",
          text: "text-emerald-600 dark:text-emerald-400",
          icon: Heart,
        }
      : data.level === "atencao"
      ? {
          label: "Atenção",
          stroke: "oklch(0.78 0.16 75)",
          text: "text-amber-600 dark:text-amber-400",
          icon: AlertTriangle,
        }
      : {
          label: "Em risco",
          stroke: "oklch(0.60 0.22 25)",
          text: "text-rose-600 dark:text-rose-400",
          icon: AlertCircle,
        };
  const Icon = cfg.icon;

  // Donut ring (SVG) — número grande no centro, estilo SaaS premium.
  const size = 76;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, data.score));
  const offset = circ - (pct / 100) * circ;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--border)"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={cfg.stroke}
              strokeWidth={stroke}
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 600ms var(--ease-out, ease)" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-display text-lg font-semibold tabular-nums leading-none ${cfg.text}`}>
              {data.score}
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Health score
            </p>
          </div>
          <p className={`mt-0.5 text-base font-semibold ${cfg.text}`}>{cfg.label}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Saúde comercial · 0–100
          </p>
        </div>
      </div>
      {data.reasons.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border/50 pt-3 text-[12px] text-muted-foreground">
          {data.reasons.slice(0, 3).map((r, i) => (
            <li key={i} className="flex gap-1.5">
              <span className={`mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full ${cfg.text}`} style={{ backgroundColor: "currentColor" }} />
              <span className="leading-snug">{r}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
