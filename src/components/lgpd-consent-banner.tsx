/**
 * Banner de consentimento LGPD.
 * - Aparece para visitantes que ainda não escolheram (chave em localStorage).
 * - Registra a escolha em `consent_log` (RLS permite anon insert sem org/user).
 * - Não bloqueia a navegação; o usuário pode "Aceitar" ou "Recusar opcionais".
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const KEY = "lovable-crm.lgpd.consent.v1";
const TEXT =
  "Usamos cookies e armazenamento local para autenticação, preferências e " +
  "métricas de uso essenciais ao funcionamento da plataforma. Você pode aceitar " +
  "ou recusar cookies opcionais (analítica e marketing).";

export function LgpdConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      // ignore
    }
  }, []);

  async function record(granted: boolean) {
    try {
      localStorage.setItem(KEY, granted ? "granted" : "essential_only");
    } catch {
      // ignore
    }
    setVisible(false);
    try {
      await supabase.from("consent_log").insert({
        subject_type: "cookie_banner",
        purpose: granted ? "all" : "essential_only",
        consent_text: TEXT,
        granted,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      });
    } catch {
      // Sem org/user, o anon pode inserir. Se falhar (offline) não bloqueia UX.
    }
  }

  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6">
      <div className="mx-auto max-w-3xl rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur sm:p-5">
        <p className="text-sm text-muted-foreground">{TEXT}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" onClick={() => record(false)}>
            Recusar opcionais
          </Button>
          <Button size="sm" onClick={() => record(true)}>
            Aceitar todos
          </Button>
        </div>
      </div>
    </div>
  );
}
