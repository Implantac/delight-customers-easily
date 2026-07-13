/**
 * Offline queue mínima para capturas de campo (QuickAdd).
 * Persiste em localStorage e reproduz quando o navegador volta a ficar online.
 * Payload é intencionalmente pequeno (nome, telefone, título, notas, cnpj) —
 * não substitui uma sincronização robusta, apenas evita perda de dados quando
 * o vendedor está em trânsito.
 */
import { supabase } from "@/integrations/supabase/client";

const KEY = "use-crm.offline-queue.v1";

export type QueuedCapture = {
  id: string;
  createdAt: number;
  orgId: string;
  userId: string;
  dealTitle: string;
  contactName: string;
  phone: string;
  pain: string;
  companyName: string;
};

function read(): QueuedCapture[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedCapture[];
  } catch {
    return [];
  }
}

function write(items: QueuedCapture[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("offline-queue:changed"));
}

export function enqueueCapture(item: Omit<QueuedCapture, "id" | "createdAt">) {
  const items = read();
  items.push({ ...item, id: crypto.randomUUID(), createdAt: Date.now() });
  write(items);
}

export function getQueue(): QueuedCapture[] {
  return read();
}

export function clearQueue() {
  write([]);
}

async function replayOne(item: QueuedCapture): Promise<boolean> {
  try {
    let companyId: string | null = null;
    if (item.companyName.trim()) {
      const { data: c } = await supabase.from("companies")
        .insert({ name: item.companyName.trim(), organization_id: item.orgId, user_id: item.userId } as any)
        .select("id").single();
      companyId = c?.id ?? null;
    }
    let contactId: string | null = null;
    if (item.contactName.trim()) {
      const { data: ct } = await supabase.from("contacts")
        .insert({
          name: item.contactName.trim(),
          phone: item.phone.trim() || null,
          organization_id: item.orgId,
          user_id: item.userId,
          company_id: companyId,
        } as any)
        .select("id").single();
      contactId = ct?.id ?? null;
    }
    const title = item.dealTitle.trim()
      || (item.contactName.trim() && `Oportunidade — ${item.contactName.trim()}`)
      || (item.companyName.trim() && `Oportunidade — ${item.companyName.trim()}`)
      || "Captura offline";
    const { error } = await supabase.from("deals").insert({
      title,
      stage: "lead" as any,
      value: 0,
      notes: item.pain.trim() || null,
      organization_id: item.orgId,
      user_id: item.userId,
      contact_id: contactId,
      company_id: companyId,
    });
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

let replaying = false;
export async function replayQueue(): Promise<{ replayed: number; remaining: number }> {
  if (replaying) return { replayed: 0, remaining: read().length };
  replaying = true;
  try {
    const items = read();
    const remaining: QueuedCapture[] = [];
    let replayed = 0;
    for (const it of items) {
      const ok = await replayOne(it);
      if (ok) replayed++;
      else remaining.push(it);
    }
    write(remaining);
    return { replayed, remaining: remaining.length };
  } finally {
    replaying = false;
  }
}

/** Registra listener global — chame uma vez no bootstrap do app. */
export function installOfflineReplay(onReplayed?: (n: number) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = async () => {
    if (!navigator.onLine) return;
    const { replayed } = await replayQueue();
    if (replayed > 0) onReplayed?.(replayed);
  };
  window.addEventListener("online", handler);
  // tentativa inicial ao carregar (caso itens tenham ficado de sessões passadas)
  handler();
  return () => window.removeEventListener("online", handler);
}
