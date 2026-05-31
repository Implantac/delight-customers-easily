import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, AlertTriangle, Copy } from "lucide-react";
import { getDataQuality } from "@/lib/dataquality.functions";

export const Route = createFileRoute("/_app/data-quality")({ component: DataQualityPage });

function DataQualityPage() {
  const { orgId } = useCurrentOrg();
  const call = useServerFn(getDataQuality);
  const { data, isLoading } = useQuery({
    queryKey: ["data-quality", orgId],
    enabled: !!orgId,
    queryFn: () => call({ data: { organization_id: orgId! } }),
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader icon={ShieldCheck} title="Data Quality Center" subtitle="Detecte duplicados, dados inválidos e oportunidades de limpeza na sua base." />

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="p-5">
              <p className="text-xs text-muted-foreground">Contatos</p>
              <p className="mt-1 text-2xl font-semibold">{data.summary.total_contacts}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-muted-foreground">Empresas</p>
              <p className="mt-1 text-2xl font-semibold">{data.summary.total_companies}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Copy className="h-3 w-3" /> Grupos duplicados</p>
              <p className="mt-1 text-2xl font-semibold text-amber-600">{data.summary.duplicate_groups}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Problemas de qualidade</p>
              <p className="mt-1 text-2xl font-semibold text-red-600">{data.summary.quality_issues}</p>
            </Card>
          </div>

          <Tabs defaultValue="duplicates">
            <TabsList>
              <TabsTrigger value="duplicates">Duplicados ({data.duplicates.length})</TabsTrigger>
              <TabsTrigger value="issues">Problemas ({data.issues.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="duplicates" className="space-y-3">
              {data.duplicates.length === 0 ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                  Nenhum duplicado detectado.
                </Card>
              ) : (
                data.duplicates.map((g) => (
                  <Card key={g.key} className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{g.reason}</p>
                      <Badge variant="outline">{g.entity === "contact" ? "Contato" : "Empresa"}</Badge>
                    </div>
                    <div className="mt-3 space-y-1">
                      {g.items.map((it) => (
                        <Link
                          key={it.id}
                          to={g.entity === "contact" ? "/contacts/$id" : "/companies/$id"}
                          params={{ id: it.id }}
                          className="flex items-center justify-between rounded border px-3 py-2 text-sm hover:bg-muted/50"
                        >
                          <span className="font-medium">{it.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {it.email ?? it.phone ?? it.website ?? "—"}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="issues">
              {data.issues.length === 0 ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                  Sem problemas detectados.
                </Card>
              ) : (
                <Card className="divide-y">
                  {data.issues.map((it, i) => (
                    <Link
                      key={i}
                      to={it.entity === "contact" ? "/contacts/$id" : "/companies/$id"}
                      params={{ id: it.id }}
                      className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{it.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {it.entity === "contact" ? "Contato" : "Empresa"} · {it.field} {it.value ? `· ${it.value}` : ""}
                        </p>
                      </div>
                      <Badge variant="destructive" className="ml-3">{it.problem}</Badge>
                    </Link>
                  ))}
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
