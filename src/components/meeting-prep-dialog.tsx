import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { generateMeetingPrep, type MeetingPrep } from "@/lib/meeting-prep.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Copy, AlertTriangle, Target, HelpCircle, ShieldAlert, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export function MeetingPrepDialog({
  orgId,
  dealId,
  trigger,
}: {
  orgId?: string;
  dealId: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [prep, setPrep] = useState<MeetingPrep | null>(null);
  const gen = useServerFn(generateMeetingPrep);

  const mut = useMutation({
    mutationFn: () => gen({ data: { organization_id: orgId!, deal_id: dealId, meeting_goal: goal || undefined } }),
    onSuccess: (r) => setPrep(r),
    onError: (e: any) => toast.error(e?.message ?? "Falhou ao gerar briefing"),
  });

  function copyAll() {
    if (!prep) return;
    const txt = [
      `# ${prep.headline}`,
      "",
      prep.context,
      "",
      "## Talking points",
      ...prep.talking_points.map((t) => `- ${t}`),
      "",
      "## Perguntas de descoberta",
      ...prep.discovery_questions.map((t) => `- ${t}`),
      "",
      "## Objeções prováveis",
      ...prep.likely_objections.map((o) => `- ${o.objection}\n  → ${o.response}`),
      "",
      "## Riscos",
      ...prep.risks.map((t) => `- ${t}`),
      "",
      `## Próxima ação: ${prep.next_action}`,
    ].join("\n");
    navigator.clipboard.writeText(txt);
    toast.success("Briefing copiado");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPrep(null); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Briefing de reunião
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Briefing pré-reunião</DialogTitle>
          <DialogDescription>Gerado por IA a partir do histórico do negócio, empresa e contato.</DialogDescription>
        </DialogHeader>

        {!prep && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Objetivo desta reunião (opcional)</label>
              <Input
                placeholder="Ex: destravar objeção de preço e agendar POC"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                maxLength={200}
              />
            </div>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending || !orgId} className="w-full">
              {mut.isPending ? "Gerando..." : "Gerar briefing"}
            </Button>
            {mut.isPending && (
              <div className="space-y-2 pt-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}
          </div>
        )}

        {prep && (
          <div className="space-y-4 text-sm">
            <div className="rounded-md border-l-4 border-primary bg-primary/5 p-3">
              <p className="font-semibold">{prep.headline}</p>
              <p className="mt-1 text-muted-foreground whitespace-pre-line">{prep.context}</p>
            </div>

            <Section icon={<Target className="h-3.5 w-3.5" />} title="Talking points">
              <ul className="list-disc space-y-1 pl-5">
                {prep.talking_points.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </Section>

            <Section icon={<HelpCircle className="h-3.5 w-3.5" />} title="Perguntas de descoberta">
              <ul className="list-disc space-y-1 pl-5">
                {prep.discovery_questions.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </Section>

            {prep.likely_objections.length > 0 && (
              <Section icon={<ShieldAlert className="h-3.5 w-3.5" />} title="Objeções prováveis">
                <ul className="space-y-2">
                  {prep.likely_objections.map((o, i) => (
                    <li key={i} className="rounded border bg-muted/30 p-2">
                      <p className="font-medium">{o.objection}</p>
                      <p className="mt-0.5 text-muted-foreground">→ {o.response}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {prep.risks.length > 0 && (
              <Section icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />} title="Riscos">
                <ul className="list-disc space-y-1 pl-5">
                  {prep.risks.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </Section>
            )}

            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <ArrowRight className="h-3.5 w-3.5" /> Próxima ação
              </div>
              <p className="mt-1">{prep.next_action}</p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={copyAll}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar tudo</Button>
              <Button variant="ghost" size="sm" onClick={() => { setPrep(null); mut.reset(); }}>Gerar outro</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon}<span>{title}</span>
      </div>
      {children}
    </div>
  );
}
