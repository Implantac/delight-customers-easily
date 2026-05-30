import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Supplier = {
  id: string;
  organization_id: string;
  legal_name: string;
  trade_name: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  category: string | null;
  payment_terms: string | null;
  website: string | null;
  address: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const listSuppliers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; search?: string; only_active?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("suppliers")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("legal_name", { ascending: true });
    if (data.only_active) q = q.eq("is_active", true);
    if (data.search) q = q.or(
      `legal_name.ilike.%${data.search}%,trade_name.ilike.%${data.search}%,document.ilike.%${data.search}%`,
    );
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Supplier[];
    return {
      suppliers: list,
      totals: {
        count: list.length,
        active: list.filter((s) => s.is_active).length,
        inactive: list.filter((s) => !s.is_active).length,
        categories: new Set(list.map((s) => s.category).filter(Boolean)).size,
      },
    };
  });

export const upsertSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    organization_id: string;
    legal_name: string;
    trade_name?: string | null;
    document?: string | null;
    email?: string | null;
    phone?: string | null;
    contact_name?: string | null;
    category?: string | null;
    payment_terms?: string | null;
    website?: string | null;
    address?: string | null;
    is_active?: boolean;
    notes?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.legal_name.trim()) throw new Error("Razão social obrigatória");
    const payload = {
      organization_id: data.organization_id,
      legal_name: data.legal_name.trim(),
      trade_name: data.trade_name?.trim() || null,
      document: data.document?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      contact_name: data.contact_name?.trim() || null,
      category: data.category?.trim() || null,
      payment_terms: data.payment_terms?.trim() || null,
      website: data.website?.trim() || null,
      address: data.address?.trim() || null,
      is_active: data.is_active ?? true,
      notes: data.notes?.trim() || null,
    };
    if (data.id) {
      const { error } = await supabase.from("suppliers").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("suppliers")
      .insert({ ...payload, created_by: userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const toggleSupplierActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; is_active: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("suppliers").update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("suppliers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
