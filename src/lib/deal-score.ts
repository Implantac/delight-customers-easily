// Pure utility — score de um negócio a partir dos dados já existentes.
// Não faz chamadas ao banco. Usado nos cards do pipeline.

export type ScoredDeal = {
  probability: number;   // 0-100, chance estimada de ganhar
  risk: number;          // 0-100, risco de esfriar / perder
  heat: "hot" | "warm" | "cold" | "frozen";
  reasons: string[];
};

const DAY = 86400000;

const STAGE_PROB: Record<string, number> = {
  lead: 10,
  qualified: 30,
  proposal: 55,
  negotiation: 75,
  won: 100,
  lost: 0,
};

export function scoreDeal(d: {
  stage: string;
  value: number | string;
  updated_at: string;
  created_at?: string;
  expected_close?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
}): ScoredDeal {
  const reasons: string[] = [];
  let probability = STAGE_PROB[d.stage] ?? 20;

  const updated = new Date(d.updated_at).getTime();
  const staleDays = Math.floor((Date.now() - updated) / DAY);

  // recência ajusta a probabilidade
  if (staleDays <= 3) { probability += 5; reasons.push("Atividade recente"); }
  else if (staleDays >= 30) { probability -= 20; reasons.push(`${staleDays}d sem movimento`); }
  else if (staleDays >= 14) { probability -= 10; reasons.push(`${staleDays}d sem movimento`); }

  // vinculação
  if (d.contact_id) { probability += 3; }
  if (d.company_id) { probability += 2; }
  if (!d.contact_id && !d.company_id) { probability -= 10; reasons.push("Sem contato/empresa"); }

  // fechamento previsto
  if (d.expected_close) {
    const days = Math.floor((new Date(d.expected_close).getTime() - Date.now()) / DAY);
    if (days < 0 && d.stage !== "won" && d.stage !== "lost") {
      probability -= 15;
      reasons.push(`Atrasado ${Math.abs(days)}d`);
    } else if (days <= 7 && d.stage === "negotiation") {
      probability += 8;
      reasons.push("Fecha esta semana");
    }
  }

  probability = Math.max(0, Math.min(100, Math.round(probability)));

  // risco: o oposto, ponderado por estágio (não conta perdido/ganho)
  let risk = 0;
  if (d.stage !== "won" && d.stage !== "lost") {
    const stageWeight = d.stage === "negotiation" ? 1.6 : d.stage === "proposal" ? 1.3 : 1;
    risk = Math.min(100, Math.round(staleDays * 1.5 * stageWeight));
  }

  let heat: ScoredDeal["heat"];
  if (d.stage === "won") heat = "hot";
  else if (d.stage === "lost") heat = "frozen";
  else if (probability >= 60 && risk < 40) heat = "hot";
  else if (probability >= 35) heat = "warm";
  else if (risk >= 60) heat = "frozen";
  else heat = "cold";

  return { probability, risk, heat, reasons };
}

export const HEAT_STYLES: Record<ScoredDeal["heat"], { dot: string; label: string; ring: string }> = {
  hot:    { dot: "bg-emerald-500",  label: "Quente",      ring: "ring-emerald-500/30" },
  warm:   { dot: "bg-amber-500",    label: "Morno",       ring: "ring-amber-500/30" },
  cold:   { dot: "bg-sky-500",      label: "Frio",        ring: "ring-sky-500/30" },
  frozen: { dot: "bg-rose-500",     label: "Em risco",    ring: "ring-rose-500/30" },
};
