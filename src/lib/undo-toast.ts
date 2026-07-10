/**
 * Toast de "Desfazer (Ns)" com contagem regressiva.
 * Extraído para permitir testes E2E isolados do fluxo de restauração.
 *
 * Contrato:
 * - Botão exibido como `Desfazer (${remainingSec}s)` enquanto `remainingSec > 0`.
 * - Ao chegar a 0, botão vira `Desfazer (0s)`, com opacity 0.5 e cursor
 *   `not-allowed`; clique dispara toast `Prazo para desfazer expirado` e
 *   NÃO chama `onRestore`.
 * - Clique dentro da janela chama `onRestore(snapshot)` e encerra o timer.
 * - Ao expirar/fechar, chama `onExpire?()` para limpeza (ex.: localStorage).
 */
import type React from "react";
import { toast } from "sonner";

export type UndoToastOptions<T> = {
  snapshot: T;
  durationMs: number;
  title: string;
  /** Rótulo do snapshot para descrição — opcional. */
  snapshotLabel?: string | null;
  onRestore: (snapshot: T) => void | Promise<void>;
  onExpire?: () => void;
  /** Mensagens customizáveis (padrões em pt-BR). */
  expiredMessage?: string;
  descriptionActive?: (remainingSec: number) => string;
  descriptionExpired?: () => string;
};

export const EXPIRED_TOAST_MESSAGE = "Prazo para desfazer expirado";

export function showUndoToast<T>(opts: UndoToastOptions<T>): string | number {
  const {
    snapshot,
    durationMs,
    title,
    snapshotLabel,
    onRestore,
    onExpire,
    expiredMessage = EXPIRED_TOAST_MESSAGE,
  } = opts;

  const endsAt = Date.now() + durationMs;
  const prefix = snapshotLabel ? `"${snapshotLabel}" · ` : "";
  const descActive =
    opts.descriptionActive ?? ((s: number) => `${prefix}restaurar em ${s}s`);
  const descExpired = opts.descriptionExpired ?? (() => `${prefix}prazo expirado`);

  let cleared = false;
  const clear = () => {
    if (cleared) return;
    cleared = true;
    onExpire?.();
  };

  const render = (remainingSec: number) => {
    const expired = remainingSec <= 0;
    return {
      description: expired ? descExpired() : descActive(remainingSec),
      action: expired
        ? {
            label: "Desfazer (0s)",
            onClick: (ev: React.MouseEvent) => {
              ev.preventDefault();
              toast.error(expiredMessage);
            },
          }
        : {
            label: `Desfazer (${remainingSec}s)`,
            onClick: () => {
              window.clearInterval(intervalId);
              if (Date.now() >= endsAt) {
                toast.error(expiredMessage);
                clear();
                return;
              }
              clear();
              void onRestore(snapshot);
            },
          },
      actionButtonStyle: expired
        ? { opacity: 0.5, pointerEvents: "none" as const, cursor: "not-allowed" }
        : undefined,
      duration: Math.max(500, endsAt - Date.now()),
      onDismiss: () => {
        window.clearInterval(intervalId);
        clear();
      },
      onAutoClose: () => {
        window.clearInterval(intervalId);
        clear();
      },
    };
  };

  const initialRemaining = Math.max(1, Math.ceil(durationMs / 1000));
  const id = toast(title, render(initialRemaining));
  const intervalId = window.setInterval(() => {
    const remainingMs = endsAt - Date.now();
    const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
    toast(title, { id, ...render(remainingSec) });
    if (remainingMs <= 0) window.clearInterval(intervalId);
  }, 1000);

  return id;
}
