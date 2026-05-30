import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ===========================================================================
// LGPD: exporta todos os dados pessoais do usuário autenticado, atrelados às
// organizações em que ele é membro. Retorna um JSON pronto para download.
// Inclui também um "esqueça-me" que apaga o vínculo do usuário com a org
// (membership). Dados do tenant (companies/deals/...) permanecem para
// continuidade do negócio, conforme contrato.
// ===========================================================================

export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profile, memberships, activities, audit] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("memberships")
        .select("organization_id, role, created_at, organizations(name)")
        .eq("user_id", userId),
      supabase
        .from("activities")
        .select("id, organization_id, type, title, description, due_date, created_at, completed")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("audit_log")
        .select("id, organization_id, action, entity_type, entity_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    return {
      exported_at: new Date().toISOString(),
      user_id: userId,
      profile: profile.data ?? null,
      memberships: memberships.data ?? [],
      activities_created: activities.data ?? [],
      audit_entries: audit.data ?? [],
    };
  });

export const leaveOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ organization_id: z.string().uuid() }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Não permite sair se for o último owner — proteção mínima
    const { data: owners } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("organization_id", data.organization_id)
      .eq("role", "owner");

    const isOwner = (owners ?? []).some((o: any) => o.user_id === userId);
    if (isOwner && (owners?.length ?? 0) <= 1) {
      throw new Error("Você é o único proprietário. Transfira a propriedade antes de sair.");
    }

    const { error } = await supabase
      .from("memberships")
      .delete()
      .eq("organization_id", data.organization_id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
