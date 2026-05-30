import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, Copy } from "lucide-react";

type LP = {
  organization_name: string;
  name: string;
  handle: string | null;
  platform: string | null;
  slug: string;
  coupon_code: string | null;
  headline: string | null;
  bio: string | null;
  hero_image_url: string | null;
  cta_text: string | null;
  cta_url: string | null;
};

export const Route = createFileRoute("/i/$org/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase.rpc("get_influencer_lp", {
      _org_slug: params.org,
      _inf_slug: params.slug,
    });
    if (error) throw new Error(error.message);
    const lp = (data?.[0] ?? null) as LP | null;
    if (!lp) throw new Error("Página não encontrada");
    return { lp, org: params.org, slug: params.slug };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.lp
      ? [
          { title: `${loaderData.lp.name} · ${loaderData.lp.organization_name}` },
          { name: "description", content: loaderData.lp.headline ?? loaderData.lp.bio ?? "" },
          { property: "og:title", content: `${loaderData.lp.name} · ${loaderData.lp.organization_name}` },
          { property: "og:description", content: loaderData.lp.headline ?? loaderData.lp.bio ?? "" },
          ...(loaderData.lp.hero_image_url
            ? [{ property: "og:image", content: loaderData.lp.hero_image_url }]
            : []),
        ]
      : [{ title: "Página não encontrada" }],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 text-center">
      <Card className="p-10 max-w-md">
        <h1 className="text-xl font-semibold mb-2">Página indisponível</h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </Card>
    </div>
  ),
  component: LandingPage,
});

function LandingPage() {
  const { lp, org, slug } = Route.useLoaderData();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    let visitorId = localStorage.getItem("inf_vid");
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem("inf_vid", visitorId);
    }
    fetch("/api/public/influencer-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_slug: org,
        slug,
        visitor_id: visitorId,
        referer: document.referrer || undefined,
        utm_source: sp.get("utm_source") || undefined,
        utm_campaign: sp.get("utm_campaign") || undefined,
      }),
    }).catch(() => {});
  }, [org, slug]);


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return toast.error("Nome e e-mail são obrigatórios");
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/lead-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: `inf-${org}-${slug}`,
          payload: {
            name, email, phone,
            channel: "influencer",
            source: slug,
            coupon: lp.coupon_code,
            organization_slug: org,
          },
          source_url: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
      if (!res.ok) throw new Error("Falha no envio");
      toast.success("Recebemos seu contato — em breve falaremos com você!");
      setName(""); setEmail(""); setPhone("");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <header className="text-center space-y-3">
          {lp.hero_image_url ? (
            <img src={lp.hero_image_url} alt={lp.name}
              className="mx-auto h-32 w-32 rounded-full object-cover ring-4 ring-primary/20" />
          ) : (
            <div className="mx-auto h-32 w-32 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-12 w-12 text-primary" />
            </div>
          )}
          <h1 className="text-3xl font-bold">{lp.name}</h1>
          {lp.handle && <p className="text-muted-foreground">@{lp.handle} {lp.platform && `· ${lp.platform}`}</p>}
          {lp.headline && <p className="text-xl text-primary font-medium">{lp.headline}</p>}
        </header>

        {lp.bio && (
          <Card className="p-6">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{lp.bio}</p>
          </Card>
        )}

        {lp.coupon_code && (
          <Card className="p-6 bg-primary/5 border-primary/20 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Cupom exclusivo</p>
            <div className="flex items-center justify-center gap-3">
              <Badge className="text-xl px-4 py-2 font-mono">{lp.coupon_code}</Badge>
              <Button size="sm" variant="outline" onClick={() => {
                navigator.clipboard.writeText(lp.coupon_code!);
                toast.success("Cupom copiado");
              }}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>
        )}

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Quero saber mais</h2>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Enviando..." : (lp.cta_text || "Quero falar com um consultor")}
            </Button>
            {lp.cta_url && (
              <a href={lp.cta_url} target="_blank" rel="noopener noreferrer"
                className="block text-center text-sm text-primary underline">
                ou acesse o site oficial
              </a>
            )}
          </form>
        </Card>

        <footer className="text-center text-xs text-muted-foreground">
          Powered by {lp.organization_name}
        </footer>
      </div>
    </div>
  );
}
