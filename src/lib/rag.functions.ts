import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash } from "crypto";

// ── Bundle os markdowns das skills em build-time (Vite import.meta.glob)
const SKILL_FILES = import.meta.glob("/src/knowledge/skills/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims → match column
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";

function requireKey(): string {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("LOVABLE_API_KEY ausente.");
  return k;
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${requireKey()}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (res.status === 429) throw new Error("Limite de uso de IA atingido.");
  if (res.status === 402) throw new Error("Créditos de IA insuficientes.");
  if (!res.ok) throw new Error(`Embeddings falharam: ${res.status} ${await res.text()}`);
  const j = await res.json();
  const v = j?.data?.[0]?.embedding;
  if (!Array.isArray(v)) throw new Error("Resposta de embedding inválida.");
  return v;
}

// Extrai frontmatter YAML (`name:`, `description:`) + corpo do markdown
function parseSkill(raw: string, fallbackSlug: string) {
  const fm = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  let name = fallbackSlug;
  let description = "";
  let body = raw;
  if (fm) {
    const meta = fm[1];
    body = fm[2].trim();
    const n = meta.match(/^name:\s*(.+)$/m);
    const d = meta.match(/^description:\s*(.+)$/m);
    if (n) name = n[1].trim();
    if (d) description = d[1].trim();
  }
  // extrai o primeiro H1 como título se não houver frontmatter name
  if (name === fallbackSlug) {
    const h1 = body.match(/^#\s+(.+)$/m);
    if (h1) name = h1[1].trim();
  }
  return { name, description, body };
}

// ─────────────────── SEED ───────────────────
export const seedKnowledgeSkills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: Array<{ slug: string; status: "created" | "updated" | "skipped"; error?: string }> = [];

    for (const [path, raw] of Object.entries(SKILL_FILES)) {
      const slug = path.split("/").pop()!.replace(/\.md$/, "");
      const { name, description, body } = parseSkill(raw, slug);
      const hash = createHash("sha256").update(body).digest("hex").slice(0, 32);

      // já existe com o mesmo hash?
      const { data: existing } = await supabaseAdmin
        .from("knowledge_docs")
        .select("id, content_hash, embedding")
        .eq("slug", slug)
        .maybeSingle();

      if (existing && existing.content_hash === hash && existing.embedding) {
        results.push({ slug, status: "skipped" });
        continue;
      }

      try {
        const vector = await embed(`${name}\n\n${description}\n\n${body}`);
        const payload = {
          slug,
          title: name,
          description,
          kind: "skill",
          content: body,
          content_hash: hash,
          embedding: vector as unknown as string, // pgvector accepts number[] via JSON
          tokens: Math.ceil(body.length / 4),
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          const { error } = await supabaseAdmin
            .from("knowledge_docs")
            .update(payload)
            .eq("id", existing.id);
          if (error) throw error;
          results.push({ slug, status: "updated" });
        } else {
          const { error } = await supabaseAdmin.from("knowledge_docs").insert(payload);
          if (error) throw error;
          results.push({ slug, status: "created" });
        }
      } catch (e: unknown) {
        results.push({ slug, status: "skipped", error: (e as Error).message });
      }
    }

    void context;
    const summary = {
      total: results.length,
      created: results.filter((r) => r.status === "created").length,
      updated: results.filter((r) => r.status === "updated").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.error).length,
      details: results,
    };
    return summary;
  });

// ─────────────────── SEARCH ───────────────────
const searchInput = z.object({
  query: z.string().min(2).max(1000),
  k: z.number().int().min(1).max(10).default(5),
});

export type KnowledgeHit = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: string;
  similarity: number;
};

export const searchKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => searchInput.parse(i))
  .handler(async ({ data, context }): Promise<{ hits: KnowledgeHit[] }> => {
    const vector = await embed(data.query);
    const { data: rows, error } = await context.supabase.rpc("match_knowledge_docs", {
      query_embedding: vector as unknown as string,
      match_count: data.k,
    });
    if (error) throw new Error(`Busca semântica falhou: ${error.message}`);
    const hits = ((rows ?? []) as Array<Omit<KnowledgeHit, "similarity"> & { similarity: number }>).map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      content: r.content,
      similarity: Number(r.similarity),
    }));
    return { hits };
  });

// Helper server-side (usado dentro de outras server-fns como copilotAsk)
export async function retrieveSkills(query: string, k = 5): Promise<KnowledgeHit[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const vector = await embed(query);
  const { data: rows, error } = await supabaseAdmin.rpc("match_knowledge_docs", {
    query_embedding: vector as unknown as string,
    match_count: k,
  });
  if (error) throw new Error(`Busca semântica falhou: ${error.message}`);
  return ((rows ?? []) as Array<KnowledgeHit>).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    content: r.content,
    similarity: Number(r.similarity),
  }));
}
