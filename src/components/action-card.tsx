import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageSquare, Mail, Phone, MapPin, Megaphone, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ActionCard — card padronizado de recomendação acionável da IA.
 * Contrato único usado em: Growth Central (Dashboard), USE Success,
 * Carteira, Customer 360, Meu Dia. Formato: motivo + impacto + canal + prazo + CTA.
 */

export type ActionChannel = "visita" | "whatsapp" | "email" | "ligacao" | "campanha";

export type ActionCardProps = {
  title: string;
  reason: string;
  subtitle?: string;
  impact_brl?: number;
  channel?: ActionChannel;
  deadline?: string; // ISO
  href?: string;
  score?: number;
  tone?: "priority" | "risk" | "reactivation" | "neutral";
  onClick?: () => void;
};

const CHANNEL_META: Record<ActionChannel, { icon: typeof MessageSquare; label: string }> = {
  visita:   { icon: MapPin,        label: "Visita" },
  whatsapp: { icon: MessageSquare, label: "WhatsApp" },
  email:    { icon: Mail,          label: "Email" },
  ligacao:  { icon: Phone,         label: "Ligação" },
  campanha: { icon: Megaphone,     label: "Campanha" },
};

const TONE_META = {
  priority:     { bar: "bg-blue-500",    text: "text-blue-600",    ring: "hover:border-blue-500/40" },
  risk:         { bar: "bg-rose-500",    text: "text-rose-600",    ring: "hover:border-rose-500/40" },
  reactivation: { bar: "bg-emerald-500", text: "text-emerald-600", ring: "hover:border-emerald-500/40" },
  neutral:      { bar: "bg-primary",     text: "text-primary",     ring: "hover:border-primary/40" },
} as const;

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function relativeDeadline(iso?: string): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = t - Date.now();
  const days = Math.round(diff / 86400_000);
  if (days < 0) return `Atrasado ${Math.abs(days)}d`;
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days <= 30) return `Em ${days}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function ActionCard({
  title, reason, subtitle, impact_brl, channel, deadline, href, score, tone = "neutral", onClick,
}: ActionCardProps) {
  const t = TONE_META[tone];
  const ch = channel ? CHANNEL_META[channel] : null;
  const dl = relativeDeadline(deadline);

  const inner = (
    <div className={cn(
      "group relative flex items-stretch gap-3 rounded-lg border border-border/60 bg-card p-2.5 transition-colors",
      t.ring,
      href || onClick ? "cursor-pointer hover:bg-accent/30" : "",
    )}>
      <div className={cn("w-0.5 shrink-0 rounded-full", t.bar)} aria-hidden />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight truncate">{title}</p>
            {subtitle && (
              <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          {typeof score === "number" && (
            <span className={cn("shrink-0 font-display text-sm font-bold tabular-nums leading-none", t.text)}>
              {score}
            </span>
          )}
        </div>

        <p className="mt-1 text-[11px] leading-snug text-muted-foreground line-clamp-2">{reason}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {typeof impact_brl === "number" && impact_brl > 0 && (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] tabular-nums font-semibold">
              {fmtBRL(impact_brl)}
            </Badge>
          )}
          {ch && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] gap-0.5">
              <ch.icon className="h-2.5 w-2.5" />
              {ch.label}
            </Badge>
          )}
          {dl && (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] gap-0.5 text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {dl}
            </Badge>
          )}
        </div>
      </div>

      {(href || onClick) && (
        <ArrowRight className="h-3.5 w-3.5 self-center shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      )}
    </div>
  );

  if (href) {
    return <Link to={href as any} className="block">{inner}</Link>;
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className="w-full text-left">{inner}</button>;
  }
  return inner;
}

export function ActionCardEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

export { fmtBRL as fmtActionBRL };
