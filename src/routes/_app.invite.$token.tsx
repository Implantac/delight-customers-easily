import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/invite/$token")({ component: AcceptInvitePage });

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("org_invites").select("id, email, role, organization_id, expires_at, accepted_at, organizations:organization_id(name)" as any)
      .eq("token", token).maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else if (!data) setError("Convite não encontrado.");
        else setInvite(data);
      });
  }, [token, user]);

  const accept = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("accept_org_invite", { _token: token });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Bem-vindo à organização!");
    navigate({ to: "/dashboard", reloadDocument: true });
    void data;
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold">Convite de workspace</h2>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {!error && !invite && <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>}
        {invite && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Você foi convidado para <span className="font-medium text-foreground">{(invite.organizations as any)?.name ?? "uma organização"}</span> como <span className="font-medium text-foreground">{invite.role}</span>.
            </p>
            {invite.accepted_at && <p className="mt-3 text-sm text-warning">Este convite já foi aceito.</p>}
            <Button className="mt-4 w-full" onClick={accept} disabled={loading || !!invite.accepted_at}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aceitar convite
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
