import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2, Flame, Snowflake, ThermometerSun, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { summarizeWhatsAppConversation } from "@/lib/wa-summary.functions";
import { toast } from "sonner";

const tempIcon = {
  quente: <Flame className="h-3.5 w-3.5 text-red-500" />,
  morno: <ThermometerSun className="h-3.5 w-3.5 text-amber-500" />,
  frio: <Snowflake className="h-3.5 w-3.5 text-sky-500" />,
} as const;

const sentimentColor = {
  positivo: "text-emerald-600 dark:text-emerald-400",
  neutro: "text-muted-foreground",
  negativo: "text-red-600 dark:text-red-400",
} as const;

type Props = {
  conversationId: string;
  compact?: boolean;
};

/**
 * Botão + painel de resumo IA de conversa WhatsApp.
 * Cabe em qualquer painel de conversa (drawer, chat, /whatsapp).
 */
export function WaConversationSummary({ conversationId, compact = false }: Props) {
  const [data, setData] = useState<any>(null);
  const fn = useServerFn(summarizeWhatsAppConversation);
  const m = useMutation({
    mutationFn: () => fn({ data: { conversation_id: conversationId, max_messages: 40 } }),
    onSuccess: setData,
    onError: (e: any) => toast.error(e.message ?? "Falha ao resumir"),
  });

  return (
    <div className={compact ? "space-y-2" : "space-y-3 rounded-lg border bg-card p-3"}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          Resumo IA
        </div>
        <Button size="sm" variant={data ? "ghost" : "secondary"} onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          {data ? "Atualizar" : "Resumir conversa"}
        </Button>
      </div>

      {data && (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1">{tempIcon[data.temperature as keyof typeof tempIcon] ?? tempIcon.morno} <span className="capitalize">{data.temperature}</span></span>
            <span className={`capitalize ${sentimentColor[data.sentiment as keyof typeof sentimentColor] ?? ""}`}>{data.sentiment}</span>
            <span className="text-muted-foreground">{data.messages_used} msgs analisadas</span>
          </div>

          {data.summary && (
            <div className="whitespace-pre-line text-sm text-foreground/90">{data.summary}</div>
          )}

          {data.next_action && (
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-sm">
              <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <div><span className="font-medium">Próxima ação:</span> {data.next_action}</div>
            </div>
          )}

          {data.risks?.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Pendências
              </div>
              <ul className="list-disc space-y-0.5 pl-4 text-foreground/80">
                {data.risks.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
