import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DAY = 86400000;
const orgInput = z.object({ organization_id: z.string().uuid() });

export type BenchmarkRow = {
  organization_id: string;
  name: string;
  isCurrent: boolean;
  isParent: boolean;
  isChild: boolean;
  wonRevenue30: number;
  wonRevenue90: number;
  openPipeline: number;
  conversion: number; // % won / (won+lost) últimos 90d
  ticketAvg: number; // últimos 90d
  activeCustomers: number; // empresas com compra nos últimos 90d
  newDeals30: number;
  activities30: number;
  overdue: number;
};

/**
 * Benchmark entre unidades do grupo empresarial.
 * Compara apenas organizações onde o usuário é membro (RLS aplicado via
 * client autenticado). Inclui a org-mãe e suas filhas (parent_org_id).
 */
export const getGroupBenchmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = Date.now();
    const ts30 = new Date(now - 30 * DAY).toISOString();
    const ts90 = new Date(now - 90 * DAY).toISOString();

    // 1) Resolver o grupo: a org atual + irmãs (se ela é filha) + filhas (se ela é mãe)
    const { data: meRow } = await supabase
      .from("organizations")
      .select("id, name, parent_org_id")
      .eq("id", data.organization_id)
      .maybeSingle();
    if (!meRow) throw new Error("Organização não encontrada");
    const rootId = meRow.parent_org_id ?? meRow.id;

    const { data: groupOrgs } = await supabase
      .from("organizations")
      .select("id, name, parent_org_id")
      .or(`id.eq.${rootId},parent_org_id.eq.${rootId}`);

    const orgs = groupOrgs ?? [meRow];

    // 2) Membership filter — só orgs que o usuário enxerga
    const { data: mems } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", userId);
    const allowed = new Set((mems ?? []).map((m) => m.organization_id));
    const scoped = orgs.filter((o) => allowed.has(o.id));
    if (scoped.length === 0) {
      return { rows: [] as BenchmarkRow[], rootId, currentId: data.organization_id, hasGroup: false };
    }
    const orgIds = scoped.map((o) => o.id);

    // 3) Buscas paralelas, escopadas via IN — RLS bloqueia o que não pode ver
    const [dealsRes, actsRes, invRes] = await Promise.all([
      supabase
        .from("deals")
        .select("organization_id, value, stage, closed_at, created_at, company_id")
        .in("organization_id", orgIds),
      supabase
        .from("activities")
        .select("organization_id, created_at, due_date")
        .in("organization_id", orgIds)
        .gte("created_at", ts30),
      supabase
        .from("invoices")
        .select("organization_id, amount, status, due_date, paid_at")
        .in("organization_id", orgIds),
    ]);

    const deals = dealsRes.data ?? [];
    const acts = actsRes.data ?? [];
    const invoices = invRes.data ?? [];

    const rows: BenchmarkRow[] = scoped.map((o) => {
      const dlist = deals.filter((d) => d.organization_id === o.id);
      const won90 = dlist.filter((d) => d.stage === "won" && (d.closed_at ?? d.created_at) >= ts90);
      const won30 = dlist.filter((d) => d.stage === "won" && (d.closed_at ?? d.created_at) >= ts30);
      const lost90 = dlist.filter((d) => d.stage === "lost" && (d.closed_at ?? d.created_at) >= ts90);
      const open = dlist.filter((d) => d.stage !== "won" && d.stage !== "lost");
      const newDeals30 = dlist.filter((d) => d.created_at >= ts30).length;

      const wonRevenue30 = won30.reduce((s, d) => s + Number(d.value), 0);
      const wonRevenue90 = won90.reduce((s, d) => s + Number(d.value), 0);
      const openPipeline = open.reduce((s, d) => s + Number(d.value), 0);
      const ticketAvg = won90.length > 0 ? wonRevenue90 / won90.length : 0;
      const closedCount = won90.length + lost90.length;
      const conversion = closedCount > 0 ? (won90.length / closedCount) * 100 : 0;
      const activeCustomers = new Set(won90.map((d) => d.company_id).filter(Boolean) as string[]).size;
      const activities30 = acts.filter((a) => a.organization_id === o.id).length;
      const overdue = invoices
        .filter((inv) => inv.organization_id === o.id && inv.status !== "paid" && !inv.paid_at)
        .filter((inv) => new Date(inv.due_date).getTime() < now)
        .reduce((s, inv) => s + Number(inv.amount), 0);

      return {
        organization_id: o.id,
        name: o.name,
        isCurrent: o.id === data.organization_id,
        isParent: o.id === rootId && o.id !== data.organization_id,
        isChild: o.parent_org_id != null,
        wonRevenue30,
        wonRevenue90,
        openPipeline,
        conversion,
        ticketAvg,
        activeCustomers,
        newDeals30,
        activities30,
        overdue,
      };
    });

    rows.sort((a, b) => b.wonRevenue90 - a.wonRevenue90);

    return {
      rows,
      rootId,
      currentId: data.organization_id,
      hasGroup: scoped.length > 1,
    };
  });
