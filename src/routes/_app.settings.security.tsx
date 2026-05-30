import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { exportMyData, leaveOrganization } from "@/lib/lgpd.functions";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Smartphone, Download, AlertTriangle, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings/security")({ component: SecurityPage });

type MFAFactor = { id: string; status: string; friendly_name?: string };

function SecurityPage() {
  const { user } = useAuth();
  const { orgId } = useCurrentOrg();
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");

  const refresh = async () => {
    setLoadingFactors(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp as MFAFactor[]) ?? []);
    setLoadingFactors(false);
  };

  useEffect(() => { refresh(); }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setEnrolling(false);
    if (error || !data) { toast.error(error?.message ?? "Falha ao iniciar"); return; }
    setEnrollData({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const verifyEnroll = async () => {
    if (!enrollData) return;
    const { data: ch } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId });
    if (!ch) { toast.error("Falha no desafio"); return; }
    const { error } = await supabase.auth.mfa.verify({
      factorId: enrollData.factorId, challengeId: ch.id, code,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("MFA ativado");
    setEnrollData(null); setCode("");
    refresh();
  };

  const unenroll = async (factorId: string) => {
    if (!confirm("Remover este fator MFA?")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) { toast.error(error.message); return; }
    toast.success("MFA removido");
    refresh();
  };

  // LGPD
  const exportFn = useServerFn(exportMyData);
  const leaveFn = useServerFn(leaveOrganization);
  const exportMut = useMutation({
    mutationFn: () => exportFn({}),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const leaveMut = useMutation({
    mutationFn: () => leaveFn({ data: { organization_id: orgId! } }),
    onSuccess: () => { toast.success("Você saiu da organização"); window.location.href = "/"; },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const activeFactors = factors.filter((f) => f.status === "verified");
  const hasMfa = activeFactors.length > 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Segurança & Privacidade"
        subtitle="Proteja sua conta com MFA e gerencie seus dados conforme a LGPD."
        icon={ShieldCheck}
      />

      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Smartphone className="h-4 w-4" /> Autenticação em 2 fatores (TOTP)
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Use Google Authenticator, 1Password ou similar. Recomendado para todas as contas com acesso a dados de clientes.
            </p>
          </div>
          <Badge variant={hasMfa ? "default" : "outline"} className={hasMfa ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : ""}>
            {hasMfa ? "Ativo" : "Inativo"}
          </Badge>
        </div>

        {loadingFactors ? <Skeleton className="h-12 w-full" /> : (
          <>
            {activeFactors.length > 0 && (
              <div className="space-y-2">
                {activeFactors.map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="text-sm">
                      <div className="font-medium">{f.friendly_name ?? "Autenticador"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{f.id.slice(0, 8)}…</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => unenroll(f.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {enrollData ? (
              <div className="space-y-3 rounded-md border p-4">
                <div className="text-sm font-medium">Escaneie o QR no seu app de autenticação:</div>
                <div className="flex items-start gap-4 flex-wrap">
                  <img src={enrollData.qr} alt="QR MFA" className="h-40 w-40 rounded bg-white p-2" />
                  <div className="space-y-2 flex-1 min-w-[200px]">
                    <Label className="text-xs">Ou digite a chave:</Label>
                    <Input readOnly value={enrollData.secret} className="font-mono text-xs" onClick={(e) => (e.target as HTMLInputElement).select()} />
                    <Label className="text-xs pt-2">Código de 6 dígitos:</Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} className="font-mono" placeholder="000000" />
                    <div className="flex gap-2">
                      <Button onClick={verifyEnroll} disabled={code.length !== 6}><KeyRound className="h-4 w-4 mr-2" />Confirmar</Button>
                      <Button variant="ghost" onClick={() => { setEnrollData(null); setCode(""); }}>Cancelar</Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Button onClick={startEnroll} disabled={enrolling} variant={hasMfa ? "outline" : "default"}>
                <Smartphone className="h-4 w-4 mr-2" />
                {hasMfa ? "Adicionar outro autenticador" : "Ativar MFA"}
              </Button>
            )}
          </>
        )}

        {user?.email && (
          <p className="text-xs text-muted-foreground border-t pt-3">
            Conta: <span className="font-mono">{user.email}</span>
          </p>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Download className="h-4 w-4" /> Exportar meus dados (LGPD)
        </h3>
        <p className="text-sm text-muted-foreground">
          Baixe em JSON: perfil, organizações em que participa, atividades criadas por você e histórico de auditoria atrelado ao seu usuário.
        </p>
        <Button onClick={() => exportMut.mutate()} disabled={exportMut.isPending} variant="outline">
          {exportMut.isPending ? "Preparando..." : "Baixar JSON"}
        </Button>
      </Card>

      <Card className="p-5 space-y-3 border-destructive/30">
        <h3 className="font-semibold flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" /> Sair desta organização
        </h3>
        <p className="text-sm text-muted-foreground">
          Remove seu acesso a esta organização. Dados de negócio permanecem com a organização (continuidade comercial). Para excluir sua conta inteira, contate o proprietário.
        </p>
        <Button
          variant="destructive"
          disabled={leaveMut.isPending || !orgId}
          onClick={() => { if (confirm("Tem certeza? Você perderá acesso a esta organização.")) leaveMut.mutate(); }}
        >
          {leaveMut.isPending ? "Saindo..." : "Sair da organização"}
        </Button>
      </Card>
    </div>
  );
}
