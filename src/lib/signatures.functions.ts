import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listSignatureRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; status?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("signature_requests")
      .select("*, signature_signers(*)")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status && data.status !== "all") q = q.eq("status", data.status as any);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const requests = (rows ?? []).map((r: any) => {
      const signers = (r.signature_signers ?? []).sort((a: any, b: any) => a.position - b.position);
      const signed = signers.filter((s: any) => s.status === "signed").length;
      return { ...r, signers, signed_count: signed, total_signers: signers.length };
    });

    const totals = {
      draft: requests.filter((r) => r.status === "draft").length,
      sent: requests.filter((r) => ["sent", "viewed"].includes(r.status)).length,
      signed: requests.filter((r) => r.status === "signed").length,
      declined: requests.filter((r) => ["declined", "expired", "cancelled"].includes(r.status)).length,
    };
    return { requests, totals };
  });

export const upsertSignatureRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    organization_id: string;
    title: string;
    description?: string | null;
    document_url?: string | null;
    company_id?: string | null;
    expires_at?: string | null;
    signers: { name: string; email: string; role?: string | null }[];
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = {
      organization_id: data.organization_id,
      title: data.title,
      description: data.description ?? null,
      document_url: data.document_url ?? null,
      company_id: data.company_id ?? null,
      expires_at: data.expires_at || null,
    };
    let reqId = data.id;
    if (reqId) {
      const { error } = await supabase.from("signature_requests").update(payload).eq("id", reqId);
      if (error) throw new Error(error.message);
      await supabase.from("signature_signers").delete().eq("request_id", reqId);
    } else {
      const { data: r, error } = await supabase
        .from("signature_requests")
        .insert({ ...payload, created_by: userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      reqId = r.id;
    }
    if (data.signers.length) {
      const { error } = await supabase.from("signature_signers").insert(
        data.signers.map((s, i) => ({
          organization_id: data.organization_id,
          request_id: reqId!,
          name: s.name,
          email: s.email,
          role: s.role ?? null,
          position: i,
        }))
      );
      if (error) throw new Error(error.message);
    }
    return { id: reqId };
  });

export const sendSignatureRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("signature_requests")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSignerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { signer_id: string; status: "viewed" | "signed" | "declined"; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: any = { status: data.status };
    const now = new Date().toISOString();
    if (data.status === "viewed") patch.viewed_at = now;
    if (data.status === "signed") { patch.signed_at = now; patch.viewed_at = now; }
    if (data.status === "declined") patch.declined_reason = data.reason ?? null;
    const { data: signer, error } = await supabase
      .from("signature_signers").update(patch).eq("id", data.signer_id).select("request_id, organization_id").single();
    if (error) throw new Error(error.message);

    // Recompute parent status
    const { data: peers } = await supabase
      .from("signature_signers").select("status").eq("request_id", signer.request_id);
    const list = peers ?? [];
    let next: string | null = null;
    if (list.some((s) => s.status === "declined")) next = "declined";
    else if (list.length && list.every((s) => s.status === "signed")) next = "signed";
    else if (data.status === "viewed") next = "viewed";
    if (next) {
      const upd: any = { status: next };
      if (next === "signed") upd.completed_at = now;
      await supabase.from("signature_requests").update(upd).eq("id", signer.request_id);
    }
    return { ok: true };
  });

export const cancelSignatureRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("signature_requests").update({ status: "cancelled" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSignatureRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("signature_requests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
