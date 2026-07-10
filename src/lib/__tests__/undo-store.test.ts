import { describe, it, expect, beforeEach } from "vitest";
import {
  UNDO_TTL_MS,
  canRestore,
  clearUndo,
  readUndo,
  remainingSeconds,
  undoKey,
  writeUndo,
  type UndoSnapshot,
} from "@/lib/undo-store";

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _dump: () => new Map(map),
  };
}

const ORG = "org-1";
const COMPANY = "company-1";
const snapshot: UndoSnapshot = {
  id: "act-1",
  user_id: "user-1",
  title: "Ligar para o cliente",
  type: "call",
  due_date: "2026-07-10T10:00:00.000Z",
  source_kind: "whatsapp",
  source_id: "wa-1",
  created_at: "2026-07-01T09:00:00.000Z",
};

describe("undo-store", () => {
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("undoKey é estável e escopado por org+company", () => {
    expect(undoKey(ORG, COMPANY)).toBe(`c360:undo:${ORG}:${COMPANY}`);
    expect(undoKey(ORG, "outra")).not.toBe(undoKey(ORG, COMPANY));
  });

  it("writeUndo grava snapshot com expiresAt = now + TTL", () => {
    const now = 1_000_000;
    const entry = writeUndo(ORG, COMPANY, snapshot, { storage, now });
    expect(entry).not.toBeNull();
    expect(entry!.expiresAt).toBe(now + UNDO_TTL_MS);
    const raw = storage.getItem(undoKey(ORG, COMPANY))!;
    expect(JSON.parse(raw)).toEqual(entry);
  });

  it("canRestore = true dentro da janela e false ao chegar / ultrapassar 0", () => {
    const now = 1_000_000;
    const entry = writeUndo(ORG, COMPANY, snapshot, { storage, now })!;

    // dentro da janela
    expect(canRestore(entry, now + 1_000)).toBe(true);
    expect(canRestore(entry, now + UNDO_TTL_MS - 1)).toBe(true);

    // exatamente 0 e depois: bloqueia
    expect(canRestore(entry, now + UNDO_TTL_MS)).toBe(false);
    expect(canRestore(entry, now + UNDO_TTL_MS + 5_000)).toBe(false);

    // entradas inválidas nunca restauram
    expect(canRestore(null)).toBe(false);
    expect(canRestore(undefined)).toBe(false);
    expect(canRestore({ snapshot: null as any, expiresAt: now + 5_000 })).toBe(false);
  });

  it("remainingSeconds nunca é negativo e chega a 0 no fim", () => {
    const now = 1_000_000;
    const entry = writeUndo(ORG, COMPANY, snapshot, { storage, now })!;
    expect(remainingSeconds(entry, now)).toBe(UNDO_TTL_MS / 1000);
    expect(remainingSeconds(entry, now + UNDO_TTL_MS - 500)).toBe(1);
    expect(remainingSeconds(entry, now + UNDO_TTL_MS)).toBe(0);
    expect(remainingSeconds(entry, now + UNDO_TTL_MS + 60_000)).toBe(0);
  });

  it("readUndo (simula reload) devolve entrada dentro da janela de 30s", () => {
    const now = 1_000_000;
    writeUndo(ORG, COMPANY, snapshot, { storage, now });

    // Recarga 5s depois: entry ainda válida.
    const entry = readUndo(ORG, COMPANY, { storage, now: now + 5_000 });
    expect(entry).not.toBeNull();
    expect(entry!.snapshot.id).toBe("act-1");
    expect(entry!.snapshot.source_kind).toBe("whatsapp");
    // A chave permanece — o toast de reload precisa dela.
    expect(storage.getItem(undoKey(ORG, COMPANY))).not.toBeNull();
  });

  it("readUndo (simula reload) devolve null e limpa a chave após 30s", () => {
    const now = 1_000_000;
    writeUndo(ORG, COMPANY, snapshot, { storage, now });

    // Recarga fora da janela.
    const entry = readUndo(ORG, COMPANY, { storage, now: now + UNDO_TTL_MS + 1 });
    expect(entry).toBeNull();
    // Entrada expirada é removida do storage para não voltar em recargas futuras.
    expect(storage.getItem(undoKey(ORG, COMPANY))).toBeNull();
  });

  it("readUndo ignora JSON inválido sem quebrar", () => {
    storage.setItem(undoKey(ORG, COMPANY), "not-json");
    expect(readUndo(ORG, COMPANY, { storage })).toBeNull();
  });

  it("clearUndo remove a chave (usado após restauração ou expiração)", () => {
    writeUndo(ORG, COMPANY, snapshot, { storage, now: 1_000_000 });
    clearUndo(ORG, COMPANY, { storage });
    expect(storage.getItem(undoKey(ORG, COMPANY))).toBeNull();
  });

  it("fluxo completo: excluir → recarregar dentro da janela → restaurar bloqueia após 0", () => {
    const t0 = 1_000_000;

    // 1) Delete: grava snapshot.
    writeUndo(ORG, COMPANY, snapshot, { storage, now: t0 });

    // 2) Reload 10s depois: undo disponível.
    const afterReload = readUndo(ORG, COMPANY, { storage, now: t0 + 10_000 });
    expect(afterReload).not.toBeNull();
    expect(canRestore(afterReload, t0 + 10_000)).toBe(true);

    // 3) Usuário demora e o contador chega a 0.
    const atZero = t0 + UNDO_TTL_MS;
    expect(canRestore(afterReload!, atZero)).toBe(false);
    expect(remainingSeconds(afterReload!, atZero)).toBe(0);

    // 4) Nova recarga após expirar: nada para restaurar e a chave é purgada.
    const afterExpired = readUndo(ORG, COMPANY, { storage, now: atZero + 1 });
    expect(afterExpired).toBeNull();
    expect(storage.getItem(undoKey(ORG, COMPANY))).toBeNull();
  });
});
