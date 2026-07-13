import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles, Send, Loader2, ArrowRight } from "lucide-react";
import { copilotAsk } from "@/lib/copilot.functions";
import { useCurrentOrg } from "@/lib/org";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Quem devo visitar hoje?",
  "Quem estou prestes a perder?",
  "Onde está minha receita em risco?",
  "Quais negócios devo priorizar essa semana?",
  "Quem são meus clientes mais valiosos sem contato recente?",
];

type Source = { n: number; slug: string; title: string; description: string | null; similarity: number };
type Turn = { role: "user" | "assistant"; content: string; actions?: Array<{ label: string; href: string }>; sources?: Source[] };

export function CopilotDrawer() {
  const { orgId } = useCurrentOrg();
  const ask = useServerFn(copilotAsk);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");

  const send = useMutation({
    mutationFn: async (question: string) => {
      if (!orgId) throw new Error("Selecione uma organização.");
      return ask({ data: { organization_id: orgId, question } });
    },
    onSuccess: (r) => setTurns((t) => [...t, { role: "assistant", content: r.answer, actions: r.actions, sources: r.sources }]),
    onError: (e: Error) => {
      toast.error(e.message);
      setTurns((t) => [...t, { role: "assistant", content: `_Erro: ${e.message}_` }]);
    },
  });

  const submit = (q: string) => {
    const text = q.trim();
    if (!text || send.isPending) return;
    setTurns((t) => [...t, { role: "user", content: text }]);
    setInput("");
    send.mutate(text);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="gap-2">
          <Sparkles className="h-4 w-4" />
          Copiloto
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
              <Sparkles className="h-4 w-4" />
            </div>
            Copiloto Comercial
          </SheetTitle>
          <SheetDescription>
            Pergunte sobre seus negócios. A IA responde usando os dados deste workspace.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {turns.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Comece com uma sugestão:</p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-left text-sm hover:bg-accent/50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) => (
            <div key={i} className="space-y-2">
              <div
                className={
                  t.role === "user"
                    ? "ml-8 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm"
                    : "mr-4 rounded-lg border bg-card px-3 py-2 text-sm whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none"
                }
              >
                {renderMarkdown(t.content, t.sources)}
              </div>
              {t.role === "assistant" && t.sources && t.sources.length > 0 && (
                <div className="mr-4 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 space-y-1.5">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Fontes ({t.sources.length})
                  </div>
                  <ol className="space-y-1">
                    {t.sources.map((s) => (
                      <li key={s.n} className="text-xs flex gap-2">
                        <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded bg-primary/15 text-primary font-medium px-1 text-[10px]">
                          {s.n}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">{s.title}</div>
                          {s.description && (
                            <div className="text-muted-foreground text-[11px] line-clamp-2">{s.description}</div>
                          )}
                        </div>
                        <span className="text-muted-foreground/70 text-[10px] shrink-0">
                          {Math.round(s.similarity * 100)}%
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {t.role === "assistant" && t.actions && t.actions.length > 0 && (
                <div className="mr-4 flex flex-wrap gap-1.5">
                  {t.actions.map((a, j) => (
                    <Button
                      key={j}
                      asChild
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs"
                      onClick={() => setOpen(false)}
                    >
                      <Link to={a.href}>
                        {a.label}
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {send.isPending && (
            <div className="mr-4 flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analisando seu CRM…
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); submit(input); }}
          className="border-t p-3 flex gap-2"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte algo…"
            rows={2}
            maxLength={2000}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input); }
            }}
          />
          <Button type="submit" size="icon" disabled={send.isPending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// Minimal markdown rendering: bold + line breaks + bullets. Avoids new dep.
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (/^[-*]\s+/.test(line)) {
          return <div key={i} className="pl-3">• {inlineFmt(line.replace(/^[-*]\s+/, ""))}</div>;
        }
        if (/^\s*$/.test(line)) return <div key={i} className="h-1" />;
        return <div key={i}>{inlineFmt(line)}</div>;
      })}
    </div>
  );
}
function inlineFmt(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}
