import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/org";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";

type EntityType = "contact" | "company" | "deal";

const COLORS: Record<string, string> = {
  slate: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  rose: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  violet: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
};

export function TagPicker({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState("slate");

  const { data: tags = [] } = useQuery({
    queryKey: ["tags", orgId],
    queryFn: async () => (await supabase.from("tags").select("*").order("name")).data ?? [],
    enabled: !!orgId,
  });

  const { data: taggings = [] } = useQuery({
    queryKey: ["taggings", entityType, entityId],
    queryFn: async () => (await supabase.from("taggings").select("id, tag_id").eq("entity_type", entityType).eq("entity_id", entityId)).data ?? [],
  });

  const selectedIds = new Set(taggings.map((t) => t.tag_id));
  const selected = tags.filter((t) => selectedIds.has(t.id));

  const createTag = useMutation({
    mutationFn: async () => {
      if (!orgId || !name.trim()) return;
      const { error } = await supabase.from("tags").insert({ organization_id: orgId, name: name.trim(), color });
      if (error) throw error;
      setName("");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags", orgId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (tagId: string) => {
      if (!orgId) return;
      const existing = taggings.find((t) => t.tag_id === tagId);
      if (existing) {
        await supabase.from("taggings").delete().eq("id", existing.id);
      } else {
        await supabase.from("taggings").insert({ organization_id: orgId, tag_id: tagId, entity_type: entityType, entity_id: entityId });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["taggings", entityType, entityId] }),
  });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((t) => (
        <Badge key={t.id} variant="outline" className={`gap-1 ${COLORS[t.color] ?? COLORS.slate}`}>
          {t.name}
          <button onClick={() => toggle.mutate(t.id)} className="ml-0.5 hover:opacity-70"><X className="h-3 w-3" /></button>
        </Badge>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"><Plus className="mr-1 h-3 w-3" />Tag</Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <p className="mb-2 text-xs font-medium text-muted-foreground flex items-center gap-1"><TagIcon className="h-3 w-3" />Etiquetas</p>
          <div className="max-h-40 overflow-auto space-y-1">
            {tags.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma criada ainda.</p>}
            {tags.map((t) => (
              <button
                key={t.id}
                onClick={() => toggle.mutate(t.id)}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-accent ${selectedIds.has(t.id) ? "bg-accent" : ""}`}
              >
                <Badge variant="outline" className={COLORS[t.color] ?? COLORS.slate}>{t.name}</Badge>
                {selectedIds.has(t.id) && <span className="text-xs text-muted-foreground">✓</span>}
              </button>
            ))}
          </div>
          <div className="mt-3 border-t pt-3">
            <p className="mb-1.5 text-xs font-medium">Nova etiqueta</p>
            <div className="flex gap-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="nome" className="h-7 text-xs" maxLength={40} />
              <select value={color} onChange={(e) => setColor(e.target.value)} className="rounded border bg-background px-1 text-xs">
                {Object.keys(COLORS).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Button size="sm" className="mt-2 h-7 w-full text-xs" disabled={!name.trim() || createTag.isPending} onClick={() => createTag.mutate()}>Criar</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
