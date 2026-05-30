import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; status?: string; search?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("assets")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.search) q = q.or(`name.ilike.%${data.search}%,serial_number.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const totals = {
      total: list.length,
      in_stock: list.filter((r: any) => r.status === "in_stock").length,
      assigned: list.filter((r: any) => r.status === "assigned").length,
      maintenance: list.filter((r: any) => r.status === "maintenance").length,
      retired: list.filter((r: any) => r.status === "retired").length,
      total_cost: list.reduce((s: number, r: any) => s + Number(r.cost ?? 0), 0),
      assigned_cost: list.filter((r: any) => r.status === "assigned").reduce((s: number, r: any) => s + Number(r.cost ?? 0), 0),
      expiring_warranty: list.filter((r: any) => r.warranty_until && r.warranty_until >= today && r.warranty_until <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)).length,
    };
    return { assets: list, totals };
  });

export const upsertAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    organization_id: string;
    name: string;
    category?: string | null;
    serial_number?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    status?: string;
    cost?: number;
    purchased_at?: string | null;
    warranty_until?: string | null;
    notes?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload: any = {
      organization_id: data.organization_id,
      name: data.name,
      category: data.category ?? null,
      serial_number: data.serial_number ?? null,
      manufacturer: data.manufacturer ?? null,
      model: data.model ?? null,
      status: data.status ?? "in_stock",
      cost: data.cost ?? 0,
      purchased_at: data.purchased_at || null,
      warranty_until: data.warranty_until || null,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await supabase.from("assets").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase.from("assets").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const deleteAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organization_id: string;
    asset_id: string;
    company_id?: string | null;
    contact_id?: string | null;
    notes?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.company_id && !data.contact_id) throw new Error("Informe empresa ou contato");

    // Close any open assignment
    await supabase
      .from("asset_assignments")
      .update({ returned_at: new Date().toISOString() })
      .eq("asset_id", data.asset_id)
      .is("returned_at", null);

    const { error: insErr } = await supabase.from("asset_assignments").insert({
      organization_id: data.organization_id,
      asset_id: data.asset_id,
      company_id: data.company_id ?? null,
      contact_id: data.contact_id ?? null,
      notes: data.notes ?? null,
      assigned_by: userId,
    });
    if (insErr) throw new Error(insErr.message);

    const { error: updErr } = await supabase.from("assets").update({
      status: "assigned",
      current_company_id: data.company_id ?? null,
      current_contact_id: data.contact_id ?? null,
      assigned_at: new Date().toISOString(),
    }).eq("id", data.asset_id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });

export const returnAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { asset_id: string; new_status?: string; notes?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase
      .from("asset_assignments")
      .update({ returned_at: new Date().toISOString(), notes: data.notes ?? null })
      .eq("asset_id", data.asset_id)
      .is("returned_at", null);

    const { error } = await supabase.from("assets").update({
      status: data.new_status ?? "in_stock",
      current_company_id: null,
      current_contact_id: null,
      assigned_at: null,
    }).eq("id", data.asset_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAssetHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { asset_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("asset_assignments")
      .select("*")
      .eq("asset_id", data.asset_id)
      .order("assigned_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { history: rows ?? [] };
  });
