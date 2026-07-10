import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { showUndoToast } from "@/lib/undo-toast";

/**
 * Rota pública de harness para o teste E2E do toast de "Desfazer".
 * Não referenciada pela UI — usada apenas em testes automatizados.
 */
export const Route = createFileRoute("/dev/undo-toast")({
  component: DevUndoToast,
  head: () => ({
    meta: [{ title: "Undo Toast E2E · Lovable" }, { name: "robots", content: "noindex" }],
  }),
});

function DevUndoToast() {
  const [restored, setRestored] = useState<string | null>(null);
  const [expired, setExpired] = useState(0);

  const trigger = (durationMs: number) => {
    setRestored(null);
    showUndoToast({
      snapshot: { title: "Ligar para o cliente", id: "act-1" },
      durationMs,
      title: "Follow-up excluído",
      snapshotLabel: "Ligar para o cliente",
      onRestore: (snap) => setRestored((snap as { id: string }).id),
      onExpire: () => setExpired((n) => n + 1),
    });
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Undo Toast harness</h1>
      <p>Rota interna para testes E2E do fluxo de "Desfazer".</p>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Button data-testid="trigger-3s" onClick={() => trigger(3000)}>
          Disparar toast (3s)
        </Button>
        <Button data-testid="trigger-1s" onClick={() => trigger(1000)}>
          Disparar toast (1s)
        </Button>
      </div>
      <pre data-testid="restored" style={{ marginTop: 24 }}>
        {restored ?? ""}
      </pre>
      <pre data-testid="expired-count">{expired}</pre>
    </div>
  );
}
