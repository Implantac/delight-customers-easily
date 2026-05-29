import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CustomFieldKind = "text" | "number" | "date" | "select" | "boolean";
export type CustomFieldEntity = "contact" | "company" | "deal";

export type CustomFieldDef = {
  id: string;
  organization_id: string;
  entity: CustomFieldEntity;
  key: string;
  label: string;
  kind: CustomFieldKind;
  options: string[];
  position: number;
};

export function useCustomFields(entity: CustomFieldEntity) {
  return useQuery({
    queryKey: ["custom-fields", entity],
    queryFn: async (): Promise<CustomFieldDef[]> => {
      const { data, error } = await supabase
        .from("custom_field_defs")
        .select("*")
        .eq("entity", entity)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

export function formatCustomValue(def: CustomFieldDef, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (def.kind === "boolean") return value ? "Sim" : "Não";
  if (def.kind === "date") {
    try { return new Date(value as string).toLocaleDateString("pt-BR"); } catch { return String(value); }
  }
  return String(value);
}
