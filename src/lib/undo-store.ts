/**
 * Armazenamento persistente para o "Desfazer" de follow-ups excluídos.
 * Guarda o snapshot da atividade em localStorage com TTL curto, para que
 * o botão continue disponível mesmo se o usuário atualizar a página.
 *
 * A lógica é pura (recebe storage/agora como parâmetros) para poder ser
 * testada sem depender do ambiente do navegador.
 */

export const UNDO_TTL_MS = 30_000;

export type UndoSnapshot = {
  id: string;
  user_id: string;
  title: string;
  type: string;
  due_date?: string | null;
  description?: string | null;
  completed?: boolean;
  company_id?: string | null;
  deal_id?: string | null;
  contact_id?: string | null;
  source_kind?: string | null;
  source_id?: string | null;
  created_at?: string;
};

export type UndoEntry = { snapshot: UndoSnapshot; expiresAt: number };

export function undoKey(orgId: string, companyId: string): string {
  return `c360:undo:${orgId}:${companyId}`;
}

/** True quando ainda estamos dentro da janela para restaurar. */
export function canRestore(entry: UndoEntry | null | undefined, now: number = Date.now()): boolean {
  if (!entry || typeof entry.expiresAt !== "number" || !entry.snapshot) return false;
  return entry.expiresAt > now;
}

/** Segundos restantes (>=0) para o botão Desfazer. */
export function remainingSeconds(entry: UndoEntry, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((entry.expiresAt - now) / 1000));
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readUndo(
  orgId: string,
  companyId: string,
  opts: { storage?: StorageLike | null; now?: number } = {},
): UndoEntry | null {
  const storage = opts.storage ?? getBrowserStorage();
  if (!storage) return null;
  const now = opts.now ?? Date.now();
  const key = undoKey(orgId, companyId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UndoEntry;
    if (!canRestore(parsed, now)) {
      storage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeUndo(
  orgId: string,
  companyId: string,
  snapshot: UndoSnapshot,
  opts: { storage?: StorageLike | null; now?: number; ttlMs?: number } = {},
): UndoEntry | null {
  const storage = opts.storage ?? getBrowserStorage();
  if (!storage) return null;
  const now = opts.now ?? Date.now();
  const ttlMs = opts.ttlMs ?? UNDO_TTL_MS;
  const entry: UndoEntry = { snapshot, expiresAt: now + ttlMs };
  try {
    storage.setItem(undoKey(orgId, companyId), JSON.stringify(entry));
    return entry;
  } catch {
    return null;
  }
}

export function clearUndo(
  orgId: string,
  companyId: string,
  opts: { storage?: StorageLike | null } = {},
): void {
  const storage = opts.storage ?? getBrowserStorage();
  if (!storage) return;
  try {
    storage.removeItem(undoKey(orgId, companyId));
  } catch {
    /* noop */
  }
}
