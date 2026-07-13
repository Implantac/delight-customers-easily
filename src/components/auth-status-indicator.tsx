import { useAuth } from "@/lib/auth";
import { CircleUser, CircleOff, Loader2 } from "lucide-react";

/**
 * Pill fixo no canto inferior direito indicando o estado da sessão Supabase.
 * Verde = signed in, cinza = signed out, âmbar = carregando.
 */
export function AuthStatusIndicator() {
  const { user, loading } = useAuth();

  const state = loading
    ? { label: "Verificando…", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: <Loader2 className="h-3 w-3 animate-spin" /> }
    : user
    ? { label: `Signed in · ${user.email ?? user.id.slice(0, 8)}`, cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: <CircleUser className="h-3 w-3" /> }
    : { label: "Signed out", cls: "bg-muted text-muted-foreground border-border", icon: <CircleOff className="h-3 w-3" /> };

  return (
    <div
      className={`fixed bottom-3 right-3 z-[60] pointer-events-none select-none rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm backdrop-blur flex items-center gap-1.5 ${state.cls}`}
      aria-live="polite"
      aria-label={`Estado de autenticação: ${state.label}`}
      data-testid="auth-status-indicator"
    >
      {state.icon}
      <span className="max-w-[220px] truncate">{state.label}</span>
    </div>
  );
}
