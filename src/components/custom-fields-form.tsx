import { useCustomFields, type CustomFieldEntity } from "@/lib/custom-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  entity: CustomFieldEntity;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
};

export function CustomFieldsForm({ entity, values, onChange }: Props) {
  const { data: fields } = useCustomFields(entity);
  if (!fields?.length) return null;

  const set = (key: string, v: unknown) => onChange({ ...values, [key]: v });

  return (
    <div className="space-y-3 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Campos personalizados</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.id} className="space-y-1.5">
            <Label className="text-xs">{f.label}</Label>
            {f.kind === "text" && (
              <Input value={(values[f.key] as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} />
            )}
            {f.kind === "number" && (
              <Input type="number" value={(values[f.key] as number) ?? ""} onChange={(e) => set(f.key, e.target.value === "" ? null : Number(e.target.value))} />
            )}
            {f.kind === "date" && (
              <Input type="date" value={(values[f.key] as string) ?? ""} onChange={(e) => set(f.key, e.target.value || null)} />
            )}
            {f.kind === "boolean" && (
              <div className="flex items-center gap-2 h-9">
                <Checkbox checked={!!values[f.key]} onCheckedChange={(c) => set(f.key, !!c)} />
                <span className="text-sm text-muted-foreground">{values[f.key] ? "Sim" : "Não"}</span>
              </div>
            )}
            {f.kind === "select" && (
              <Select value={(values[f.key] as string) ?? ""} onValueChange={(v) => set(f.key, v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {f.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
