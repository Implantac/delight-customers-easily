import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  trimmed(max).optional().transform((v) => (v && v.length > 0 ? v : null));

export const contactSchema = z.object({
  name: trimmed(150).min(1, "Nome é obrigatório"),
  email: z.string().trim().max(255).email("Email inválido").optional().or(z.literal("")).transform((v) => (v ? v : null)),
  phone: optionalText(30),
  position: optionalText(120),
  company_id: optionalText(64),
  notes: optionalText(1000),
});

export const companySchema = z.object({
  name: trimmed(150).min(1, "Nome é obrigatório"),
  website: z.string().trim().max(255).url("URL inválida").optional().or(z.literal("")).transform((v) => (v ? v : null)),
  industry: optionalText(120),
  size: optionalText(50),
  notes: optionalText(1000),
});

export const dealSchema = z.object({
  title: trimmed(150).min(1, "Título é obrigatório"),
  value: z.coerce.number().min(0).max(999_999_999),
  stage: z.enum(["lead", "qualified", "proposal", "negotiation", "won", "lost"]),
  contact_id: optionalText(64),
  company_id: optionalText(64),
  expected_close: optionalText(20),
  notes: optionalText(1000),
});

export const activitySchema = z.object({
  type: z.enum(["task", "call", "email", "meeting", "note"]),
  title: trimmed(200).min(1, "Título é obrigatório"),
  description: optionalText(1000),
  due_date: optionalText(40),
  contact_id: optionalText(64),
  deal_id: optionalText(64),
});

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido").max(255),
  role: z.enum(["admin", "member"]),
});

export function fromForm<T extends z.ZodTypeAny>(schema: T, form: FormData): z.infer<T> {
  const obj: Record<string, unknown> = {};
  form.forEach((v, k) => { obj[k] = v === "" ? undefined : v; });
  return schema.parse(obj);
}
