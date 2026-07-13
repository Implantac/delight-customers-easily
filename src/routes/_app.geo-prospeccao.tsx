import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/org";
import {
  searchProspects,
  findSimilarCompanies,
  addProspectAsLead,
} from "@/lib/geo-prospect.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Compass, Search, Plus, Sparkles, MapPin, Building, ArrowRight } from "lucide-react";
import { ClientsMap, type MapPoint } from "@/components/clients-map";
import { toast } from "sonner";


export const Route = createFileRoute("/_app/geo-prospeccao")({ component: ProspeccaoPage });

function ProspeccaoPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const search = useServerFn(searchProspects);
  const similar = useServerFn(findSimilarCompanies);
  const addLead = useServerFn(addProspectAsLead);

  const [filters, setFilters] = useState({ industry: "", city: "", state: "", radius_km: "" });
  const [searched, setSearched] = useState(false);

  const searchQ = useQuery({
    queryKey: ["geo-prospect-search", orgId, filters],
    enabled: !!orgId && searched,
    queryFn: () =>
      search({
        data: {
          organization_id: orgId!,
          industry: filters.industry || undefined,
          city: filters.city || undefined,
          state: filters.state || undefined,
          radius_km: filters.radius_km ? Number(filters.radius_km) : undefined,
          limit: 50,
        },
      }),
  });

  const [similarSource, setSimilarSource] = useState<string>("");
  const myCompaniesQ = useQuery({
    queryKey: ["geo-my-companies", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name, city, state")
        .order("name")
        .limit(200);
      return data ?? [];
    },
  });
  const similarQ = useQuery({
    queryKey: ["geo-similar", orgId, similarSource],
    enabled: !!orgId && !!similarSource,
    queryFn: () =>
      similar({ data: { organization_id: orgId!, company_id: similarSource, limit: 20 } }),
  });


  const addM = useMutation({
    mutationFn: (company_id: string) =>
      addLead({ data: { organization_id: orgId!, company_id } }),
    onSuccess: () => {
      toast.success("Adicionado ao CRM como Lead.");
      qc.invalidateQueries({ queryKey: ["geo-prospect-search"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao adicionar"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospecção Inteligente"
        subtitle="Encontre novas empresas para visitar a partir de segmento, cidade ou empresas semelhantes às suas melhores contas."
        icon={Compass}
      />

      <Tabs defaultValue="buscar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="buscar">Buscar empresas</TabsTrigger>
          <TabsTrigger value="semelhantes">Empresas semelhantes</TabsTrigger>
        </TabsList>

        <TabsContent value="buscar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtros de prospecção</CardTitle>
              <CardDescription>Preencha o que conhece — quanto mais específico, melhor.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Segmento / CNAE</Label>
                <Input
                  placeholder="Ex: Construção"
                  value={filters.industry}
                  onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input
                  placeholder="Ex: Londrina"
                  value={filters.city}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estado (UF)</Label>
                <Input
                  placeholder="PR"
                  maxLength={2}
                  value={filters.state}
                  onChange={(e) => setFilters({ ...filters, state: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Raio (km, opcional)</Label>
                <Input
                  type="number"
                  placeholder="50"
                  value={filters.radius_km}
                  onChange={(e) => setFilters({ ...filters, radius_km: e.target.value })}
                />
              </div>
              <div className="md:col-span-4 flex justify-end">
                <Button onClick={() => setSearched(true)} className="gap-2">
                  <Search className="h-4 w-4" /> Buscar prospects
                </Button>
              </div>
            </CardContent>
          </Card>

          {!searched && (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center">
                <Compass className="mx-auto h-8 w-8 text-primary/60" />
                <h3 className="mt-3 font-semibold">Pronto para descobrir novos clientes?</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Defina pelo menos um filtro acima (segmento, cidade ou UF) e clique em <strong>Buscar prospects</strong>.
                  Os resultados aparecem aqui ordenados por potencial.
                </p>
              </CardContent>
            </Card>
          )}



          {searched && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  Resultados
                  {searchQ.data && (
                    <Badge variant="secondary">{searchQ.data.total} empresa(s)</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {searchQ.isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : !searchQ.data?.results.length ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhuma empresa encontrada com esses filtros. Tente ampliar a busca.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="text-left px-3 py-2">Nome</th>
                          <th className="text-left px-3 py-2">Cidade / UF</th>
                          <th className="text-left px-3 py-2">Segmento</th>
                          <th className="text-right px-3 py-2">Distância</th>
                          <th className="text-right px-3 py-2">Potencial</th>
                          <th className="text-right px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchQ.data.results.map((r) => (
                          <tr key={r.id} className="border-t">
                            <td className="px-3 py-2 font-medium">{r.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {[r.city, r.state].filter(Boolean).join(" · ") || "—"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{r.industry ?? "—"}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs">
                              {typeof r.distance_km === "number" ? `${r.distance_km.toFixed(0)} km` : "—"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Badge
                                className={
                                  r.potential >= 70
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                    : r.potential >= 40
                                      ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                      : "bg-muted text-muted-foreground"
                                }
                                variant="outline"
                              >
                                {r.potential}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1"
                                disabled={addM.isPending}
                                onClick={() => addM.mutate(r.id)}
                              >
                                <Plus className="h-3 w-3" /> Adicionar ao CRM
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="semelhantes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Encontrar empresas parecidas
              </CardTitle>
              <CardDescription>
                Escolha um cliente seu — o sistema sugere empresas parecidas no perfil (segmento, cidade, porte).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Empresa de referência</Label>
                <Select value={similarSource} onValueChange={setSimilarSource}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        myCompaniesQ.isLoading
                          ? "Carregando suas empresas…"
                          : (myCompaniesQ.data?.length ?? 0) === 0
                            ? "Você ainda não tem empresas cadastradas"
                            : "Selecione uma empresa"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {myCompaniesQ.data?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {(c.city || c.state) && (
                          <span className="text-muted-foreground">
                            {" · "}
                            {[c.city, c.state].filter(Boolean).join("/")}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(myCompaniesQ.data?.length ?? 0) === 0 && !myCompaniesQ.isLoading && (
                  <p className="text-xs text-muted-foreground">
                    <Link to="/companies" className="underline">Cadastre uma empresa</Link> ou importe via Connect Hub para usar este recurso.
                  </p>
                )}
              </div>
              {!similarSource && !similarQ.isLoading && (
                <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                  <Sparkles className="mx-auto mb-2 h-5 w-5 text-primary/60" />
                  Escolha uma empresa acima para ver até 20 prospects semelhantes.
                </div>
              )}

              {similarQ.isLoading && <Skeleton className="h-32 w-full" />}
              {similarQ.data && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Empresas parecidas com <strong>{similarQ.data.source.name}</strong>:
                  </p>
                  {similarQ.data.results.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma similar encontrada.</p>
                  ) : (
                    similarQ.data.results.map((r) => (
                      <Card key={r.id} className="p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{r.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[r.city, r.state, r.industry].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Score {r.score}</Badge>
                          <Button asChild size="sm" variant="ghost">
                            <Link to="/companies/$id" params={{ id: r.id }}>
                              Abrir <ArrowRight className="h-3 w-3 ml-1" />
                            </Link>
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}
              {similarQ.error && (
                <p className="text-sm text-red-600">
                  {(similarQ.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="bg-muted/30">
        <CardContent className="p-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" />
            Veja também a Cobertura Territorial para descobrir cidades com baixa penetração.
          </span>
          <Link to="/geo-cobertura">
            <Button variant="ghost" size="sm">Abrir Cobertura</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
