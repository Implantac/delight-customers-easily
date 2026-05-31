import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { z } from "zod";

const paramsSchema = z.object({ token: z.string().uuid() });

type PublicProposal = {
  id: string;
  title: string;
  status: string;
  valid_until: string | null;
  notes: string | null;
  subtotal: number;
  discount_percent: number;
  total: number;
  accepted_at: string | null;
  rejected_at: string | null;
  organization_name: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    sort_order: number;
  }>;
};

async function loadProposal(token: string): Promise<PublicProposal | null> {
  const { data, error } = await supabase.rpc("get_public_proposal", { _token: token });
  if (error) throw new Error(error.message);
  return (data as PublicProposal | null) ?? null;
}

export const Route = createFileRoute("/p/$token")({
  parseParams: (raw) => paramsSchema.parse(raw),
  loader: async ({ params }) => {
    const proposal = await loadProposal(params.token);
    if (!proposal) throw notFound();
    return { proposal };
  },
  component: PublicProposalPage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <p className="text-destructive">Não foi possível carregar a proposta: {error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <p className="text-muted-foreground">Proposta não encontrada ou link inválido.</p>
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Proposta comercial" },
      { name: "description", content: "Revise e responda à sua proposta comercial." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function fmtBRL(v: number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PublicProposalPage() {
  const { token } = Route.useParams();
  const initial = Route.useLoaderData().proposal;
  const [proposal, setProposal] = useState(initial);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<null | "accept" | "reject">(null);

  const isClosed = proposal.status === "accepted" || proposal.status === "rejected";
  const expired =
    proposal.valid_until != null && new Date(proposal.valid_until).getTime() < Date.now();

  async function respond(action: "accept" | "reject") {
    if (!name.trim()) {
      toast.error("Informe seu nome");
      return;
    }
    setBusy(action);
    const { data, error } = await supabase.rpc("respond_public_proposal", {
      _token: token,
      _action: action,
      _name: name.trim(),
      _email: email.trim() || "",
    });
    setBusy(null);
    if (error || data === false) {
      toast.error(error?.message ?? "Não foi possível registrar sua resposta");
      return;
    }
    toast.success(action === "accept" ? "Proposta aceita!" : "Resposta registrada");
    const fresh = await loadProposal(token);
    if (fresh) setProposal(fresh);
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="text-center">
          <p className="text-sm text-muted-foreground">{proposal.organization_name}</p>
          <h1 className="text-3xl font-semibold mt-1">{proposal.title}</h1>
          <div className="mt-3 flex justify-center gap-2">
            <Badge variant={isClosed ? "secondary" : "default"}>
              {proposal.status === "accepted"
                ? "Aceita"
                : proposal.status === "rejected"
                ? "Recusada"
                : proposal.status === "sent"
                ? "Aguardando"
                : "Rascunho"}
            </Badge>
            {expired && !isClosed && <Badge variant="destructive">Validade expirada</Badge>}
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Itens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {proposal.items.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem itens nesta proposta.</p>
            )}
            {proposal.items.map((it: PublicProposal["items"][number], idx: number) => {
              const line = Number(it.quantity) * Number(it.unit_price);
              const disc = line * (Number(it.discount_percent) / 100);
              const total = line - disc;
              return (
                <div key={idx} className="flex justify-between items-start border-b last:border-0 pb-2">
                  <div className="flex-1">
                    <p className="font-medium">{it.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {it.quantity} × {fmtBRL(Number(it.unit_price))}
                      {Number(it.discount_percent) > 0 && ` · ${it.discount_percent}% desc.`}
                    </p>
                  </div>
                  <p className="font-medium">{fmtBRL(total)}</p>
                </div>
              );
            })}

            <div className="pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{fmtBRL(Number(proposal.subtotal))}</span>
              </div>
              {Number(proposal.discount_percent) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Desconto geral</span>
                  <span>−{proposal.discount_percent}%</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                <span>Total</span>
                <span>{fmtBRL(Number(proposal.total))}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {proposal.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{proposal.notes}</p>
            </CardContent>
          </Card>
        )}

        {!isClosed && !expired && (
          <Card>
            <CardHeader>
              <CardTitle>Responder à proposta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Seu nome completo" value={name} onChange={(e) => setName(e.target.value)} />
              <Input
                type="email"
                placeholder="Seu email (opcional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="flex gap-2 pt-2">
                <Button onClick={() => respond("accept")} disabled={busy !== null} className="flex-1">
                  {busy === "accept" ? "Enviando…" : "Aceitar proposta"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => respond("reject")}
                  disabled={busy !== null}
                  className="flex-1"
                >
                  {busy === "reject" ? "Enviando…" : "Recusar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isClosed && (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Resposta registrada em{" "}
              {new Date(proposal.accepted_at ?? proposal.rejected_at ?? "").toLocaleString("pt-BR")}.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
