import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Auditoria de consistência dos dados de demonstração (e de produção).
 *
 * Roda uma bateria de verificações na organização atual do usuário:
 * - Contagens mínimas por entidade (para telas não ficarem vazias)
 * - Relacionamentos obrigatórios (ex.: deal sem company/contact)
 * - Campos obrigatórios vazios
 * - Registros órfãos (referências quebradas)
 * - Filtros / segmentações padrão (deals abertos, atividades futuras, etc.)
 *
 * Cada verificação retorna: id, screen, label, status, count, detail.
 */

const Input = z.object({ organization_id: z.string().uuid() });

export type AuditStatus = "ok" | "warn" | "fail";
export type AuditCheck = {
  id: string;
  screen: string;
  label: string;
  status: AuditStatus;
  count: number;
  detail: string;
};

type Row = { c: number };

export const auditDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const org = data.organization_id;
    const checks: AuditCheck[] = [];

    const countOf = async (table: string, filter?: (q: any) => any) => {
      let q = sb.from(table).select("id", { count: "exact", head: true }).eq("organization_id", org);
      if (filter) q = filter(q);
      const { count, error } = await q;
      if (error) return { count: -1, err: error.message };
      return { count: (count ?? 0) as number };
    };

    const min = (
      id: string,
      screen: string,
      label: string,
      count: number,
      threshold: number,
      unit = "registros",
    ): AuditCheck => ({
      id,
      screen,
      label,
      status: count < 0 ? "fail" : count === 0 ? "fail" : count < threshold ? "warn" : "ok",
      count: Math.max(0, count),
      detail:
        count < 0
          ? "Erro ao consultar tabela"
          : count === 0
            ? `Nenhum ${unit} — a tela ficará vazia`
            : count < threshold
              ? `Poucos ${unit} (${count} < ${threshold})`
              : `${count} ${unit}`,
    });

    // ---- Contagens mínimas por tela ----
    const [companies, contacts, deals, activities, goals, reps, geo, cust360, whats, tickets, camps, leads] =
      await Promise.all([
        countOf("companies"),
        countOf("contacts"),
        countOf("deals"),
        countOf("activities"),
        countOf("sales_goals"),
        countOf("erp_sales_reps"),
        countOf("geo_locations"),
        countOf("customer_360_snapshot"),
        countOf("whatsapp_conversations"),
        countOf("tickets"),
        countOf("email_campaigns"),
        countOf("marketing_leads"),
      ]);

    checks.push(min("companies", "/companies", "Contas B2B", companies.count, 5, "empresas"));
    checks.push(min("contacts", "/contacts", "Contatos e Pessoas", contacts.count, 10, "contatos"));
    checks.push(min("deals", "/pipeline", "Pipeline / Oportunidades", deals.count, 10, "oportunidades"));
    checks.push(min("activities", "/calendar", "Agenda / Atividades", activities.count, 10, "atividades"));
    checks.push(min("goals", "/goals", "Metas Comerciais", goals.count, 1, "metas"));
    checks.push(min("reps", "/representantes", "Representantes", reps.count, 2, "reps"));
    checks.push(min("geo", "/geo", "Geointeligência", geo.count, 5, "pontos no mapa"));
    checks.push(min("c360", "/customer-360", "Customer 360", cust360.count, 5, "snapshots"));
    checks.push(min("whats", "/whatsapp", "WhatsApp", whats.count, 1, "conversas"));
    checks.push(min("tickets", "/site-chat", "Tickets / Suporte", tickets.count, 1, "tickets"));
    checks.push(min("camps", "/campaigns", "Campanhas de Email", camps.count, 1, "campanhas"));
    checks.push(min("leads", "/leads", "Leads de Marketing", leads.count, 3, "leads"));

    // ---- Relacionamentos obrigatórios ----
    const orphanCheck = async (
      id: string,
      screen: string,
      label: string,
      table: string,
      fk: string,
      warnDetail: string,
    ) => {
      const { count } = await sb
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org)
        .is(fk, null);
      const n = (count ?? 0) as number;
      checks.push({
        id,
        screen,
        label,
        status: n === 0 ? "ok" : "warn",
        count: n,
        detail: n === 0 ? "Todos vinculados" : `${n} ${warnDetail}`,
      });
    };

    await orphanCheck("deal_company", "/pipeline", "Deals sem empresa", "deals", "company_id", "deals sem company_id");
    await orphanCheck("deal_contact", "/pipeline", "Deals sem contato", "deals", "contact_id", "deals sem contact_id");
    await orphanCheck(
      "contact_company",
      "/contacts",
      "Contatos sem empresa",
      "contacts",
      "company_id",
      "contatos sem company_id",
    );
    await orphanCheck(
      "activity_link",
      "/calendar",
      "Atividades sem vínculo",
      "activities",
      "deal_id",
      "atividades sem deal_id (também sem contact_id em muitos casos)",
    );

    // ---- Filtros padrão que alimentam as telas ----
    const openDeals = await countOf("deals", (q) => q.not("stage", "in", "(won,lost)"));
    checks.push({
      id: "open_deals",
      screen: "/pipeline",
      label: "Oportunidades em aberto",
      status: openDeals.count > 0 ? "ok" : "fail",
      count: openDeals.count,
      detail:
        openDeals.count > 0
          ? `${openDeals.count} deals abertos alimentam o pipeline`
          : "Pipeline vazio — todas as deals estão won/lost",
    });

    const wonDeals = await countOf("deals", (q) => q.eq("stage", "won"));
    checks.push({
      id: "won_deals",
      screen: "/dashboard",
      label: "Deals ganhas (forecast/dashboard)",
      status: wonDeals.count > 0 ? "ok" : "warn",
      count: wonDeals.count,
      detail: wonDeals.count > 0 ? `${wonDeals.count} deals ganhas` : "Sem histórico de vitórias",
    });

    const withCoords = await countOf("geo_locations", (q) =>
      q.not("latitude", "is", null).not("longitude", "is", null),
    );
    checks.push({
      id: "geo_coords",
      screen: "/geo",
      label: "Pontos com lat/long válidos",
      status: withCoords.count >= 5 ? "ok" : withCoords.count > 0 ? "warn" : "fail",
      count: withCoords.count,
      detail:
        withCoords.count >= 5
          ? `${withCoords.count} pontos plotáveis`
          : withCoords.count > 0
            ? `Apenas ${withCoords.count} pontos plotáveis`
            : "Nenhum ponto com coordenadas",
    });

    const futureAct = await countOf("activities", (q) =>
      q.gte("due_date", new Date().toISOString()).eq("completed", false),
    );
    checks.push({
      id: "future_activities",
      screen: "/meu-dia",
      label: "Atividades futuras em aberto",
      status: futureAct.count > 0 ? "ok" : "warn",
      count: futureAct.count,
      detail:
        futureAct.count > 0
          ? `${futureAct.count} atividades futuras alimentam Meu Dia`
          : "Nenhuma atividade futura — Meu Dia ficará vazio",
    });

    // ---- Campos obrigatórios preenchidos ----
    const compNoCity = await countOf("companies", (q) => q.or("city.is.null,city.eq."));
    checks.push({
      id: "comp_city",
      screen: "/companies",
      label: "Empresas sem cidade",
      status: compNoCity.count === 0 ? "ok" : compNoCity.count < 3 ? "warn" : "fail",
      count: compNoCity.count,
      detail:
        compNoCity.count === 0
          ? "Todas com cidade"
          : `${compNoCity.count} empresas sem cidade (afeta Geo/relatórios regionais)`,
    });

    const contactNoEmail = await countOf("contacts", (q) => q.or("email.is.null,email.eq."));
    checks.push({
      id: "contact_email",
      screen: "/contacts",
      label: "Contatos sem email",
      status: contactNoEmail.count === 0 ? "ok" : "warn",
      count: contactNoEmail.count,
      detail:
        contactNoEmail.count === 0
          ? "Todos com email"
          : `${contactNoEmail.count} contatos sem email (afeta campanhas)`,
    });

    // ---- Sumário ----
    const summary = {
      total: checks.length,
      ok: checks.filter((c) => c.status === "ok").length,
      warn: checks.filter((c) => c.status === "warn").length,
      fail: checks.filter((c) => c.status === "fail").length,
    };

    return { checks, summary, ranAt: new Date().toISOString() };
  });
