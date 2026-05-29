import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import { LayoutDashboard, KanbanSquare, Users, Building2, CheckSquare, Plus, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

type SearchHit =
  | { kind: "contact"; id: string; label: string; sub?: string | null }
  | { kind: "company"; id: string; label: string; sub?: string | null }
  | { kind: "deal"; id: string; label: string; sub?: string | null };

export function CommandPaletteTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 w-full max-w-xs justify-start gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar ou comando…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium md:inline">⌘K</kbd>
      </Button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const { data: hits } = useQuery({
    queryKey: ["palette-search", query],
    enabled: open && query.trim().length >= 2,
    queryFn: async (): Promise<SearchHit[]> => {
      const q = `%${query.trim()}%`;
      const [contacts, companies, deals] = await Promise.all([
        supabase.from("contacts").select("id, name, email").ilike("name", q).limit(5),
        supabase.from("companies").select("id, name, industry").ilike("name", q).limit(5),
        supabase.from("deals").select("id, title, value").ilike("title", q).limit(5),
      ]);
      return [
        ...(contacts.data ?? []).map((c) => ({ kind: "contact" as const, id: c.id, label: c.name, sub: c.email })),
        ...(companies.data ?? []).map((c) => ({ kind: "company" as const, id: c.id, label: c.name, sub: c.industry })),
        ...(deals.data ?? []).map((d) => ({ kind: "deal" as const, id: d.id, label: d.title, sub: null })),
      ];
    },
  });

  const go = (to: string) => { onOpenChange(false); setQuery(""); navigate({ to }); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Busque contatos, empresas, negócios ou execute um comando…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>

        {hits && hits.length > 0 && (
          <>
            <CommandGroup heading="Resultados">
              {hits.map((h) => {
                const Icon = h.kind === "contact" ? Users : h.kind === "company" ? Building2 : KanbanSquare;
                const to = h.kind === "contact" ? "/contacts" : h.kind === "company" ? "/companies" : "/pipeline";
                return (
                  <CommandItem key={`${h.kind}-${h.id}`} onSelect={() => go(to)}>
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{h.label}</span>
                    {h.sub && <span className="ml-2 text-xs text-muted-foreground">{h.sub}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => go("/dashboard")}><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard<CommandShortcut>G D</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go("/pipeline")}><KanbanSquare className="mr-2 h-4 w-4" />Pipeline<CommandShortcut>G P</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go("/contacts")}><Users className="mr-2 h-4 w-4" />Contatos<CommandShortcut>G C</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go("/companies")}><Building2 className="mr-2 h-4 w-4" />Empresas<CommandShortcut>G E</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go("/activities")}><CheckSquare className="mr-2 h-4 w-4" />Atividades<CommandShortcut>G A</CommandShortcut></CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => go("/contacts")}><Plus className="mr-2 h-4 w-4" />Novo contato</CommandItem>
          <CommandItem onSelect={() => go("/companies")}><Plus className="mr-2 h-4 w-4" />Nova empresa</CommandItem>
          <CommandItem onSelect={() => go("/pipeline")}><Plus className="mr-2 h-4 w-4" />Novo negócio</CommandItem>
          <CommandItem onSelect={() => go("/activities")}><Plus className="mr-2 h-4 w-4" />Nova atividade</CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Tema">
          <CommandItem onSelect={() => { setTheme("light"); onOpenChange(false); }}><Sun className="mr-2 h-4 w-4" />Tema claro</CommandItem>
          <CommandItem onSelect={() => { setTheme("dark"); onOpenChange(false); }}><Moon className="mr-2 h-4 w-4" />Tema escuro</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
