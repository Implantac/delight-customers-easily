import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import {
  listLocalAgents,
  createLocalAgent,
  revokeLocalAgent,
} from "@/lib/erp-local-agent.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import {
  Server,
  Plus,
  Copy,
  Trash2,
  ChevronLeft,
  Download,
  ShieldCheck,
  CheckCircle2,
  Circle,
} from "lucide-react";

export const Route = createFileRoute("/_app/integrations/agent")({
  component: LocalAgentPage,
});

function LocalAgentPage() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const qc = useQueryClient();
  const listFn = useServerFn(listLocalAgents);
  const createFn = useServerFn(createLocalAgent);
  const revokeFn = useServerFn(revokeLocalAgent);
  const [name, setName] = useState("");

  const agents = useQuery({
    queryKey: ["local-agents", orgId],
    queryFn: () => listFn({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 30_000,
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { organizationId: orgId!, name: name.trim() } }),
    onSuccess: () => {
      toast.success("Agente criado. Copie o código de pareamento.");
      setName("");
      qc.invalidateQueries({ queryKey: ["local-agents", orgId] });
    },
    onError: (e: any) => toast.error("Falha ao criar", { description: e?.message }),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { organizationId: orgId!, agentId: id } }),
    onSuccess: () => {
      toast.success("Agente revogado.");
      qc.invalidateQueries({ queryKey: ["local-agents", orgId] });
    },
    onError: (e: any) => toast.error("Falha", { description: e?.message }),
  });

  if (!canManage) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Apenas administradores podem gerenciar o Agente Local.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <Link to="/integrations" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4 mr-1" /> Voltar para Integrações
      </Link>

      <PageHeader
        icon={Server}
        title="Agente Local"
        subtitle="Para ERPs que rodam dentro da sua empresa (Firebird, SQL Server local, sistemas legados)."
      />

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <CardTitle className="text-base">Como funciona</CardTitle>
              <CardDescription className="mt-1">
                O Agente Local é um pequeno programa instalado em um computador da sua empresa.
                Ele conecta no seu ERP interno e envia os dados ao CRM por um canal seguro —
                sem precisar abrir portas no firewall ou expor o banco na internet.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-5">
            <li>Crie um agente abaixo e copie o código de pareamento.</li>
            <li>Baixe o instalador para Windows/Linux e cole o código quando solicitado.</li>
            <li>Configure a conexão do ERP no próprio agente (ele guarda local).</li>
            <li>Pronto — o agente aparece como "online" e começa a sincronizar.</li>
          </ol>
          <Button variant="outline" size="sm" className="mt-3 gap-2" disabled>
            <Download className="h-4 w-4" /> Baixar instalador (em breve)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Criar novo agente</CardTitle>
          <CardDescription>
            Use um nome que ajude você a lembrar onde ele está rodando (ex: "Servidor matriz").
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="agent-name">Nome do agente</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Servidor da matriz"
              maxLength={80}
            />
          </div>
          <Button
            onClick={() => createMut.mutate()}
            disabled={!name.trim() || createMut.isPending}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Gerar código de pareamento
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Agentes registrados</h2>
        {agents.isLoading ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando…</CardContent></Card>
        ) : (agents.data?.agents ?? []).length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhum agente cadastrado ainda.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {(agents.data?.agents ?? []).map((a: any) => {
              const isOnline = a.status === "online";
              const isRevoked = a.status === "revoked";
              return (
                <Card key={a.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isOnline ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium truncate">{a.name}</span>
                        <Badge
                          variant="outline"
                          className={
                            isOnline
                              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                              : isRevoked
                              ? "border-red-500/40 text-red-700 dark:text-red-400"
                              : "text-muted-foreground"
                          }
                        >
                          {isOnline ? "Online" : isRevoked ? "Revogado" : "Aguardando"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <code className="font-mono bg-muted px-1.5 py-0.5 rounded">
                          {a.pairing_code}
                        </code>
                        <button
                          type="button"
                          className="hover:text-foreground inline-flex items-center gap-1"
                          onClick={() => {
                            navigator.clipboard.writeText(a.pairing_code);
                            toast.success("Código copiado");
                          }}
                        >
                          <Copy className="h-3 w-3" /> copiar
                        </button>
                        {a.last_seen_at && (
                          <span>· visto em {new Date(a.last_seen_at).toLocaleString("pt-BR")}</span>
                        )}
                      </div>
                    </div>
                    {!isRevoked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 gap-1"
                        onClick={() => revokeMut.mutate(a.id)}
                        disabled={revokeMut.isPending}
                      >
                        <Trash2 className="h-4 w-4" /> Revogar
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
