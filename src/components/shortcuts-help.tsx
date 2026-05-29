import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "⌘ K", label: "Abrir paleta de comandos" },
  { keys: "G D", label: "Ir para Dashboard" },
  { keys: "G P", label: "Ir para Pipeline" },
  { keys: "G C", label: "Ir para Contatos" },
  { keys: "G E", label: "Ir para Empresas" },
  { keys: "G A", label: "Ir para Atividades" },
  { keys: "G R", label: "Ir para Relatórios" },
  { keys: "?", label: "Mostrar atalhos" },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "?") { e.preventDefault(); setOpen((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Atalhos de teclado</DialogTitle></DialogHeader>
        <ul className="mt-2 space-y-2">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">{s.keys}</kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
