import { useState } from "react";
import { playbookFor, fillTemplate, type PlaybookStep } from "@/lib/playbooks";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, Phone, Calendar, Sparkles, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const ICONS: Record<PlaybookStep["channel"], any> = {
  email: Mail, whatsapp: MessageCircle, call: Phone, meeting: Calendar, internal: Sparkles,
};

const LABELS: Record<PlaybookStep["channel"], string> = {
  email: "E-mail", whatsapp: "WhatsApp", call: "Ligação", meeting: "Reunião", internal: "Interno",
};

export function DealPlaybook({
  stage,
  vars,
}: {
  stage: string;
  vars?: Record<string, string | undefined>;
}) {
  const pb = playbookFor(stage);
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <Card className="p-4 border-primary/20 bg-primary/5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Playbook · {pb.label}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{pb.goal}</p>
        </div>
        <Badge variant="outline">{pb.steps.length} ações</Badge>
      </div>

      <ol className="space-y-2">
        {pb.steps.map((step, i) => {
          const Icon = ICONS[step.channel];
          const isOpen = expanded === i;
          const filled = step.template && vars ? fillTemplate(step.template, vars) : step.template;
          return (
            <li key={i} className="rounded-md border bg-background overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : i)}
                className="w-full px-3 py-2 flex items-center gap-3 hover:bg-muted/50 text-left"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {i + 1}
                </div>
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{LABELS[step.channel]}</p>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 space-y-2 border-t">
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  {filled && (
                    <div className="rounded bg-muted p-2 text-xs font-mono whitespace-pre-wrap">
                      {filled}
                    </div>
                  )}
                  {filled && (
                    <Button
                      size="sm" variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(filled);
                        toast.success("Copiado para a área de transferência");
                      }}
                    >
                      <Copy className="mr-2 h-3 w-3" />Copiar
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
