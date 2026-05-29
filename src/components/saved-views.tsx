import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/org";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Bookmark, BookmarkPlus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

type Entity = "contacts" | "companies" | "deals" | "activities";

interface Props {
  entity: Entity;
  currentFilters: Record<string, unknown>;
  onApply: (filters: Record<string, unknown>) => void;
}

export function SavedViews({ entity, currentFilters, onApply }: Props) {
  const { orgId: organizationId } = useCurrentOrg();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);

  const { data: views = [] } = useQuery({
    queryKey: ["saved_views", entity, organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("saved_views")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("entity", entity)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!organizationId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId || !userId) throw new Error("Sem organização");
      const { error } = await supabase.from("saved_views").insert({
        organization_id: organizationId,
        user_id: userId,
        entity,
        name: name.trim(),
        filters: currentFilters as never,
        is_shared: shared,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved_views", entity, organizationId] });
      toast.success("Filtro salvo");
      setSaveOpen(false);
      setName("");
      setShared(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_views").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved_views", entity, organizationId] });
      toast.success("Filtro removido");
    },
  });

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Bookmark className="h-4 w-4" />
            Filtros salvos
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="end">
          <div className="space-y-1 max-h-72 overflow-auto">
            {views.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">Nenhum filtro salvo ainda.</p>
            )}
            {views.map((v) => (
              <div key={v.id} className="flex items-center gap-1 rounded hover:bg-accent">
                <button
                  type="button"
                  onClick={() => {
                    onApply((v.filters as Record<string, unknown>) ?? {});
                    setOpen(false);
                  }}
                  className="flex-1 text-left px-2 py-1.5 text-sm flex items-center gap-2"
                >
                  <span className="truncate">{v.name}</span>
                  {v.is_shared && <Users className="h-3 w-3 text-muted-foreground shrink-0" />}
                </button>
                {v.user_id === userId && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(v.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="border-t pt-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => {
                setOpen(false);
                setSaveOpen(true);
              }}
            >
              <BookmarkPlus className="h-4 w-4" />
              Salvar filtros atuais
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Salvar filtro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="view-name">Nome</Label>
              <Input
                id="view-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Leads quentes SP"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="view-shared" className="text-sm font-normal">
                Compartilhar com a equipe
              </Label>
              <Switch id="view-shared" checked={shared} onCheckedChange={setShared} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!name.trim() || saveMutation.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
