import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Bloqueia o conteúdo se o usuário atual não for owner/admin da organização ativa.
 * RLS já impede escrita no backend, isto é apenas para evitar telas inúteis.
 */
export function RequireManager({ children }: { children: React.ReactNode }) {
  const { loading } = useCurrentOrg();
  const canManage = useCanManage();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
        Carregando…
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center max-w-md mx-auto">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Acesso restrito</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Apenas administradores e proprietários da organização podem acessar esta página.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/dashboard">Voltar ao Dashboard</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
