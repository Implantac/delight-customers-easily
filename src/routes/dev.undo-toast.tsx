import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EXPIRED_TOAST_MESSAGE, showUndoToast } from "@/lib/undo-toast";
import {
  clearUndo,
  readUndo,
  undoKey,
  writeUndo,
  type UndoSnapshot,
} from "@/lib/undo-store";

/**
 * Rota pública de harness para os testes E2E do "Desfazer".
 * Não referenciada pela UI — usada apenas em testes automatizados.
 */
export const Route = createFileRoute("/dev/undo-toast")({
  component: DevUndoToast,
  head: () => ({
    meta: [{ title: "Undo Toast E2E · Lovable" }, { name: "robots", content: "noindex" }],
  }),
});

const HARNESS_ORG = "dev";
const HARNESS_COMPANY = "harness";

const SNAPSHOT: UndoSnapshot = {
  id: "act-1",
  user_id: "user-1",
  title: "Ligar para o cliente",
  type: "call",
};

function DevUndoToast() {
  const [restored, setRestored] = useState<string | null>(null);
  const [expired, setExpired] = useState(0);
  const bootChecked = useRef(false);

  // === Comportamento na carga da página (simula o que _app.customer-360 faz) ===
  // Se existir um snapshot persistido:
  //   - dentro da janela → reabre o toast "Desfazer (Ns)"
  //   - fora da janela  → mostra "Prazo para desfazer expirado" e limpa a chave
  useEffect(() => {
    if (bootChecked.current) return;
    bootChecked.current = true;

    const raw = typeof window !== "undefined"
      ? window.localStorage.getItem(undoKey(HARNESS_ORG, HARNESS_COMPANY))
      : null;

    const entry = readUndo(HARNESS_ORG, HARNESS_COMPANY);
    if (entry) {
      // Ainda dentro da janela — reabre o toast com o tempo restante real.
      const remaining = Math.max(1_000, entry.expiresAt - Date.now());
      showUndoToast({
        snapshot: entry.snapshot,
        durationMs: remaining,
        title: "Follow-up excluído",
        snapshotLabel: entry.snapshot.title,
        onRestore: (snap) => {
          setRestored((snap as UndoSnapshot).id);
          clearUndo(HARNESS_ORG, HARNESS_COMPANY);
        },
        onExpire: () => {
          setExpired((n) => n + 1);
          clearUndo(HARNESS_ORG, HARNESS_COMPANY);
        },
      });
    } else if (raw) {
      // Havia entrada, mas readUndo devolveu null → expirou e foi purgada.
      toast.error(EXPIRED_TOAST_MESSAGE);
      setExpired((n) => n + 1);
    }
  }, []);

  const trigger = (durationMs: number, persist: boolean) => {
    setRestored(null);
    if (persist) {
      writeUndo(HARNESS_ORG, HARNESS_COMPANY, SNAPSHOT, { ttlMs: durationMs });
    }
    showUndoToast({
      snapshot: SNAPSHOT,
      durationMs,
      title: "Follow-up excluído",
      snapshotLabel: SNAPSHOT.title,
      onRestore: (snap) => {
        setRestored((snap as UndoSnapshot).id);
        if (persist) clearUndo(HARNESS_ORG, HARNESS_COMPANY);
      },
      onExpire: () => {
        setExpired((n) => n + 1);
        if (persist) clearUndo(HARNESS_ORG, HARNESS_COMPANY);
      },
    });
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Undo Toast harness</h1>
      <p>Rota interna para testes E2E do fluxo de "Desfazer".</p>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <Button data-testid="trigger-3s" onClick={() => trigger(3000, false)}>
          Disparar toast (3s)
        </Button>
        <Button data-testid="trigger-1s" onClick={() => trigger(1000, false)}>
          Disparar toast (1s)
        </Button>
        <Button data-testid="trigger-persist-1s" onClick={() => trigger(1000, true)}>
          Delete persistente (1s)
        </Button>
        <Button data-testid="trigger-persist-3s" onClick={() => trigger(3000, true)}>
          Delete persistente (3s)
        </Button>
      </div>
      <pre data-testid="restored" style={{ marginTop: 24 }}>
        {restored ?? ""}
      </pre>
      <pre data-testid="expired-count">{expired}</pre>
    </div>
  );
}
