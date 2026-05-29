import { supabase } from "@/integrations/supabase/client";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const normPhone = (s: string) => s.replace(/\D+/g, "");

export type ContactDup = { id: string; name: string; email: string | null; phone: string | null; reason: string };
export type CompanyDup = { id: string; name: string; website: string | null; reason: string };

export async function findContactDuplicates(input: { name?: string; email?: string; phone?: string }): Promise<ContactDup[]> {
  const filters: string[] = [];
  if (input.email && input.email.trim()) filters.push(`email.ilike.${input.email.trim()}`);
  if (input.phone && normPhone(input.phone).length >= 6) filters.push(`phone.ilike.%${normPhone(input.phone).slice(-8)}%`);
  if (input.name && input.name.trim().length >= 3) filters.push(`name.ilike.%${norm(input.name)}%`);
  if (filters.length === 0) return [];
  const { data } = await supabase.from("contacts").select("id, name, email, phone").or(filters.join(",")).limit(5);
  const out: ContactDup[] = [];
  for (const c of data ?? []) {
    const reasons: string[] = [];
    if (input.email && c.email && norm(c.email) === norm(input.email)) reasons.push("mesmo email");
    if (input.phone && c.phone && normPhone(c.phone) === normPhone(input.phone)) reasons.push("mesmo telefone");
    if (input.name && norm(c.name) === norm(input.name)) reasons.push("mesmo nome");
    if (reasons.length) out.push({ ...c, reason: reasons.join(", ") });
  }
  return out;
}

export async function findCompanyDuplicates(input: { name?: string; website?: string }): Promise<CompanyDup[]> {
  if (!input.name || input.name.trim().length < 3) return [];
  const { data } = await supabase.from("companies").select("id, name, website").ilike("name", `%${norm(input.name)}%`).limit(5);
  const out: CompanyDup[] = [];
  for (const c of data ?? []) {
    const reasons: string[] = [];
    if (norm(c.name) === norm(input.name)) reasons.push("mesmo nome");
    if (input.website && c.website && norm(c.website) === norm(input.website)) reasons.push("mesmo site");
    if (reasons.length) out.push({ ...c, reason: reasons.join(", ") });
  }
  return out;
}
