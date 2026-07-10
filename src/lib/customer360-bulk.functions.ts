/**
 * Ações em massa para Customer 360.
 * Seleção de várias empresas → criar atividade, adicionar a campanha,
 * ou atribuir representante (owner).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ACTIVITY_TYPES = ["call", "email", "meeting", "task", "note"] as const;

/** Cria UMA atividade por empresa selecionada (vinculada a um contato da empresa se houver). */
export const bulkCreateActivityForCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        companyIds: z.array(z.string().uuid()).min(1).max(500),
        title: z.string().min(1).max(200),
        type: z.enum(ACTIVITY_TYPES).default("task"),
        dueDate: z.string().datetime().optional(),
        description: z.string().max(2000).optional(),
        /** Amarração ao evento de origem na timeline do Customer 360. */
        sourceKind: z.string().min(1).max(32).optional(),
        sourceId: z.string().min(1).max(128).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Para cada empresa, tenta achar 1 contato (primeiro) para vincular.
    const { data: contacts, error: cErr } = await supabase
      .from("contacts")
      .select("id, company_id")
      .eq("organization_id", data.organizationId)
      .in("company_id", data.companyIds);
    if (cErr) throw new Error(cErr.message);

    const contactByCompany = new Map<string, string>();
    for (const c of contacts ?? []) {
      if (c.company_id && !contactByCompany.has(c.company_id)) {
        contactByCompany.set(c.company_id, c.id);
      }
    }

    const rows = data.companyIds.map((companyId) => ({
      organization_id: data.organizationId,
      user_id: userId,
      title: data.title,
      type: data.type,
      due_date: data.dueDate ?? null,
      description: data.description ?? null,
      contact_id: contactByCompany.get(companyId) ?? null,
      company_id: companyId,
      source_kind: data.sourceKind ?? null,
      source_id: data.sourceId ?? null,
    }));

    const { error } = await supabase.from("activities").insert(rows);
    if (error) throw new Error(error.message);
    return { created: rows.length };
  });

/** Atribui (ou transfere) o owner das empresas selecionadas a um usuário da org. */
export const bulkAssignCompaniesOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        companyIds: z.array(z.string().uuid()).min(1).max(500),
        newOwnerId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Apenas owner/admin/manager pode reatribuir
    const { data: canManage } = await supabase.rpc("has_org_role", {
      _org: data.organizationId,
      _user: userId,
      _roles: ["owner", "admin", "manager"],
    });
    if (!canManage) throw new Error("Apenas gestores podem reatribuir representante");

    // Garante que o novo owner é membro da organização
    const { data: member, error: mErr } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("organization_id", data.organizationId)
      .eq("user_id", data.newOwnerId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member) throw new Error("Usuário não é membro desta organização");

    const { error } = await supabase
      .from("companies")
      .update({ user_id: data.newOwnerId })
      .eq("organization_id", data.organizationId)
      .in("id", data.companyIds);
    if (error) throw new Error(error.message);
    return { updated: data.companyIds.length };
  });

/** Adiciona TODOS os contatos com email das empresas selecionadas como destinatários da campanha. */
export const bulkAddCompaniesToCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        companyIds: z.array(z.string().uuid()).min(1).max(500),
        campaignId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: contacts, error: cErr } = await supabase
      .from("contacts")
      .select("id, name, email")
      .eq("organization_id", data.organizationId)
      .in("company_id", data.companyIds)
      .not("email", "is", null);
    if (cErr) throw new Error(cErr.message);

    if (!contacts || contacts.length === 0) {
      return { added: 0, skipped: 0, reason: "Nenhum contato com e-mail nas empresas selecionadas." };
    }

    const { data: existing } = await supabase
      .from("email_campaign_recipients")
      .select("contact_id")
      .eq("campaign_id", data.campaignId);
    const have = new Set((existing ?? []).map((e: any) => e.contact_id));

    const fresh = contacts.filter((c: any) => c.email && !have.has(c.id));
    if (fresh.length === 0) {
      return { added: 0, skipped: contacts.length };
    }

    const { error } = await supabase.from("email_campaign_recipients").insert(
      fresh.map((c: any) => ({
        organization_id: data.organizationId,
        campaign_id: data.campaignId,
        contact_id: c.id,
        email: c.email,
        name: c.name,
      })),
    );
    if (error) throw new Error(error.message);

    const total = (existing?.length ?? 0) + fresh.length;
    await supabase.from("email_campaigns").update({ total_recipients: total }).eq("id", data.campaignId);

    return { added: fresh.length, skipped: contacts.length - fresh.length };
  });

/**
 * Cria mensagens em massa na whatsapp_outbox para as empresas selecionadas
 * (uma mensagem por empresa, usando o phone primário). Respeita janela 24h
 * apenas como aviso — o envio real é feito pelo worker do canal.
 * Substitui {name} pelo nome da empresa no template.
 */
export const bulkSendWhatsAppToCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        companyIds: z.array(z.string().uuid()).min(1).max(500),
        body: z.string().min(1).max(1500),
        channelId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Canal: usa o passado ou pega o default ativo da org
    let channelId = data.channelId;
    if (!channelId) {
      const { data: ch } = await supabase
        .from("whatsapp_channels")
        .select("id")
        .eq("organization_id", data.organizationId)
        .eq("status", "active")
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      channelId = ch?.id;
    }
    if (!channelId) {
      throw new Error("Nenhum canal WhatsApp ativo. Configure em Configurações → WhatsApp.");
    }

    const { data: companies, error: cErr } = await supabase
      .from("companies")
      .select("id, name, phone")
      .eq("organization_id", data.organizationId)
      .in("id", data.companyIds);
    if (cErr) throw new Error(cErr.message);

    const valid = (companies ?? []).filter((c: any) => c.phone && String(c.phone).trim().length >= 8);
    if (valid.length === 0) {
      return { queued: 0, skipped: companies?.length ?? 0, reason: "Nenhuma empresa selecionada tem telefone." };
    }

    const rows = valid.map((c: any) => ({
      organization_id: data.organizationId,
      channel_id: channelId,
      to_phone: String(c.phone).replace(/\D/g, ""),
      body: data.body.replace(/\{name\}/g, c.name ?? "cliente"),
    }));

    const { error } = await supabase.from("whatsapp_outbox").insert(rows);
    if (error) throw new Error(error.message);

    return {
      queued: rows.length,
      skipped: (companies?.length ?? 0) - rows.length,
    };
  });
