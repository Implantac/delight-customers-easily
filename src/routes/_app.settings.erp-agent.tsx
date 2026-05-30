import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { listAgentTokens, createAgentToken, revokeAgentToken } from "@/lib/erp-agent.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Server, Plus, Copy, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings/erp-agent")({ component: ErpAgentPage });

function ErpAgentPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const list = useServerFn(listAgentTokens);
  const create = useServerFn(createAgentToken);
  const revoke = useServerFn(revokeAgentToken);

  const { data, isLoading } = useQuery({
    queryKey: ["erp-agent-tokens", orgId],
    enabled: !!orgId,
    queryFn: () => list({ data: { organization_id: orgId! } }),
  });

  const [name, setName] = useState("");
  const [issued, setIssued] = useState<string | null>(null);

  const mCreate = useMutation({
    mutationFn: () => create({ data: { organization_id: orgId!, name } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["erp-agent-tokens", orgId] });
      setIssued(r.token);
      setName("");
      toast.success("Token gerado — copie agora, ele não será mostrado novamente.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const mRevoke = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["erp-agent-tokens", orgId] });
      toast.success("Token revogado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const endpoint = typeof window !== "undefined"
    ? `${window.location.origin}/api/public/hooks/erp-agent-push`
    : "/api/public/hooks/erp-agent-push";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agente ERP local"
        subtitle="Conecte seu ERP on-premise (Windows/Linux) ao CRM via push autenticado."
        icon={Server}
      />

      <Card className="p-6 space-y-3">
        <h2 className="font-semibold">Como funciona</h2>
        <ol className="text-sm text-muted-foreground list-decimal pl-4 space-y-1">
          <li>Baixe o binário do <strong>USE ERP Connect Agent</strong> e instale no servidor que tem acesso ao ERP.</li>
          <li>Gere um token abaixo e cole no agente.</li>
          <li>Configure os mapeamentos de tabelas/queries no agente — ele enviará lotes para o endpoint.</li>
        </ol>
        <div className="rounded-md bg-muted/40 p-3 text-xs font-mono break-all">{endpoint}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled className="gap-2">
            <Download className="h-3.5 w-3.5" /> Baixar agente (em breve)
          </Button>
          <span className="text-xs text-muted-foreground self-center">
            Binário Tauri assinado · Windows / Linux · auto-update
          </span>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="font-semibold">Novo token</h2>
        <div className="flex gap-2">
          <Input placeholder="Ex: Servidor Matriz" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={() => name && mCreate.mutate()} disabled={!name || mCreate.isPending} className="gap-2">
            <Plus className="h-4 w-4" /> Gerar
          </Button>
        </div>
        {issued && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Copie e guarde — não será mostrado novamente:</p>
            <div className="flex gap-2">
              <code className="flex-1 text-xs font-mono break-all bg-background p-2 rounded">{issued}</code>
              <Button size="sm" variant="outline" onClick={() => {
                navigator.clipboard.writeText(issued); toast.success("Copiado");
              }}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setIssued(null)}>Fechar</Button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-6 py-3 border-b font-semibold text-sm">Tokens ativos</div>
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-20 w-full" /></div>
        ) : !data?.tokens.length ? (
          <div className="p-6 text-sm text-muted-foreground text-center">Nenhum token gerado ainda.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3">Nome</th><th className="text-left p-3">Status</th><th className="text-left p-3">Último uso</th><th></th></tr>
            </thead>
            <tbody>
              {data.tokens.map((t: any) => (
                <tr key={t.id} className="border-t">
                  <td className="p-3 font-medium">{t.name}</td>
                  <td className="p-3">
                    {t.revoked_at ? <Badge variant="destructive">revogado</Badge> : <Badge>ativo</Badge>}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {t.last_used_at ? new Date(t.last_used_at).toLocaleString("pt-BR") : "—"}
                  </td>
                  <td className="p-3 text-right">
                    {!t.revoked_at && (
                      <Button size="sm" variant="ghost" onClick={() => mRevoke.mutate(t.id)} className="gap-1">
                        <Trash2 className="h-3.5 w-3.5" /> Revogar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
