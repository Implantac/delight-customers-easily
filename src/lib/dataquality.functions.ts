import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ organization_id: z.string().uuid() });

const normPhone = (s: string) => s.replace(/\D+/g, "");
const normStr = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const isEmailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const isPhoneValid = (p: string) => normPhone(p).length >= 10 && normPhone(p).length <= 13;

export type DupGroup = {
  key: string;
  reason: string;
  entity: "contact" | "company";
  items: Array<{ id: string; name: string; email?: string | null; phone?: string | null; website?: string | null }>;
};

export type QualityIssue = {
  entity: "contact" | "company";
  id: string;
  name: string;
  field: string;
  value: string | null;
  problem: string;
};

export const getDataQuality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;

    const [contactsRes, companiesRes] = await Promise.all([
      supabase.from("contacts").select("id, name, email, phone").eq("organization_id", org),
      supabase.from("companies").select("id, name, website").eq("organization_id", org),
    ]);
    if (contactsRes.error) throw new Error(contactsRes.error.message);
    if (companiesRes.error) throw new Error(companiesRes.error.message);

    const contacts = contactsRes.data ?? [];
    const companies = companiesRes.data ?? [];

    // --- Duplicates ---
    const dupGroups: DupGroup[] = [];

    const byEmail = new Map<string, typeof contacts>();
    const byPhone = new Map<string, typeof contacts>();
    const byContactName = new Map<string, typeof contacts>();
    for (const c of contacts) {
      if (c.email) {
        const k = normStr(c.email);
        byEmail.set(k, [...(byEmail.get(k) ?? []), c]);
      }
      if (c.phone) {
        const k = normPhone(c.phone);
        if (k.length >= 8) byPhone.set(k, [...(byPhone.get(k) ?? []), c]);
      }
      const nk = normStr(c.name ?? "");
      if (nk.length >= 4) byContactName.set(nk, [...(byContactName.get(nk) ?? []), c]);
    }
    for (const [k, list] of byEmail) if (list.length > 1) dupGroups.push({ key: `ce:${k}`, reason: `Mesmo email: ${k}`, entity: "contact", items: list });
    for (const [k, list] of byPhone) if (list.length > 1) dupGroups.push({ key: `cp:${k}`, reason: `Mesmo telefone: ${k}`, entity: "contact", items: list });
    for (const [k, list] of byContactName) if (list.length > 1) dupGroups.push({ key: `cn:${k}`, reason: `Mesmo nome: ${k}`, entity: "contact", items: list });

    const byCompanyName = new Map<string, typeof companies>();
    const byWebsite = new Map<string, typeof companies>();
    for (const c of companies) {
      const nk = normStr(c.name ?? "");
      if (nk.length >= 3) byCompanyName.set(nk, [...(byCompanyName.get(nk) ?? []), c]);
      if (c.website) {
        const k = normStr(c.website).replace(/^https?:\/\//, "").replace(/\/$/, "");
        byWebsite.set(k, [...(byWebsite.get(k) ?? []), c]);
      }
    }
    for (const [k, list] of byCompanyName) if (list.length > 1) dupGroups.push({ key: `on:${k}`, reason: `Mesmo nome: ${k}`, entity: "company", items: list });
    for (const [k, list] of byWebsite) if (list.length > 1) dupGroups.push({ key: `ow:${k}`, reason: `Mesmo site: ${k}`, entity: "company", items: list });

    // --- Quality issues ---
    const issues: QualityIssue[] = [];
    for (const c of contacts) {
      if (!c.email && !c.phone) issues.push({ entity: "contact", id: c.id, name: c.name, field: "contato", value: null, problem: "Sem email e sem telefone" });
      if (c.email && !isEmailValid(c.email)) issues.push({ entity: "contact", id: c.id, name: c.name, field: "email", value: c.email, problem: "Email inválido" });
      if (c.phone && !isPhoneValid(c.phone)) issues.push({ entity: "contact", id: c.id, name: c.name, field: "phone", value: c.phone, problem: "Telefone inválido" });
      if (!c.name || c.name.trim().length < 2) issues.push({ entity: "contact", id: c.id, name: c.name ?? "(sem nome)", field: "name", value: c.name, problem: "Nome ausente" });
    }
    for (const c of companies) {
      if (!c.name || c.name.trim().length < 2) issues.push({ entity: "company", id: c.id, name: c.name ?? "(sem nome)", field: "name", value: c.name, problem: "Nome ausente" });
      if (c.website && !/^https?:\/\/|\./.test(c.website)) issues.push({ entity: "company", id: c.id, name: c.name, field: "website", value: c.website, problem: "Site provavelmente inválido" });
    }

    return {
      summary: {
        total_contacts: contacts.length,
        total_companies: companies.length,
        duplicate_groups: dupGroups.length,
        quality_issues: issues.length,
      },
      duplicates: dupGroups.slice(0, 100),
      issues: issues.slice(0, 200),
    };
  });
