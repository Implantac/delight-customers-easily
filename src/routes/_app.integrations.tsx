import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import {
  getErpIntegration, saveErpIntegration, deleteErpIntegration,
  testErpConnection,
} from "@/lib/erp.functions";
import { ERP_CATALOG, getErpHealth, type ErpProviderCatalog } from "@/lib/erp-hub.functions";
import { testBlingConnection, importContactsFromBling } from "@/lib/bling.functions";
import { previewCsvImport, runCsvImport } from "@/lib/csv-import.functions";
import {
  listFieldMappings, upsertFieldMapping, deleteFieldMapping, listInboundLog,
} from "@/lib/erp-mappings.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plug, CheckCircle2, AlertCircle, Trash2, RefreshCw, ExternalLink,
  Activity, Database, Cloud, Server, FileText, Sparkles, ArrowRight,
  Wifi, WifiOff, Loader2, Upload, Webhook, Copy,
} from "lucide-react";

export const Route = createFileRoute("/_app/integrations")({ component: ErpHubPage });

type ProviderId = "omie" | "bling" | "custom";

function ErpHubPage() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const [wizardProvider, setWizardProvider] = useState<ErpProviderCatalog | null>(null);

  if (!canManage) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Apenas administradores podem gerenciar integrações ERP.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Plug className="h-6 w-6" /> ERP Connect Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Conecte o CRM a qualquer ERP — via API (Omie, Bling), webhook universal,
            CSV ou agente local. Mapeie campos uma vez, sincronize sempre.
          </p>
        </div>
      </div>

      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog"><Cloud className="h-4 w-4 mr-2" /> Catálogo</TabsTrigger>
          <TabsTrigger value="health"><Activity className="h-4 w-4 mr-2" /> Health</TabsTrigger>
          <TabsTrigger value="csv"><Upload className="h-4 w-4 mr-2" /> Importar CSV</TabsTrigger>
          <TabsTrigger value="webhook"><Webhook className="h-4 w-4 mr-2" /> Webhook universal</TabsTrigger>
          <TabsTrigger value="mappings"><Database className="h-4 w-4 mr-2" /> Mapeamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          <CatalogTab orgId={orgId} onConfigure={setWizardProvider} />
        </TabsContent>
        <TabsContent value="health"><HealthTab orgId={orgId} /></TabsContent>
        <TabsContent value="csv"><CsvImportTab orgId={orgId} /></TabsContent>
        <TabsContent value="webhook"><WebhookTab orgId={orgId} /></TabsContent>
        <TabsContent value="mappings"><MappingsTab orgId={orgId} /></TabsContent>
      </Tabs>

      <Sheet open={!!wizardProvider} onOpenChange={(o) => !o && setWizardProvider(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {wizardProvider && (
            <ConnectWizard
              provider={wizardProvider}
              orgId={orgId}
              onClose={() => setWizardProvider(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ============================================================================
// Catálogo
// ============================================================================

function CatalogTab({ orgId, onConfigure }: { orgId: string | null; onConfigure: (p: ErpProviderCatalog) => void }) {
  const getHealth = useServerFn(getErpHealth);
  const { data } = useQuery({
    queryKey: ["erp-health", orgId],
    queryFn: () => getHealth({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 60_000,
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ERP_CATALOG.map((p) => {
        const h = data?.rows.find((r) => r.provider === p.id);
        return (
          <Card key={p.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {providerIcon(p)}
                  {p.name}
                </CardTitle>
                <ProviderStatusBadge provider={p} health={h} />
              </div>
              <CardDescription className="text-xs">{p.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <div className="flex flex-wrap gap-1">
                {p.methods.map((m) => (
                  <Badge key={m} variant="outline" className="text-[10px] uppercase tracking-wide">
                    {labelMethod(m)}
                  </Badge>
                ))}
              </div>
              {h?.is_configured && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {h.last_sync_at && <div>Última sync: {new Date(h.last_sync_at).toLocaleString("pt-BR")}</div>}
                  {h.latency_ms != null && <div>Latência: {h.latency_ms}ms</div>}
                </div>
              )}
              <Button
                size="sm"
                variant={h?.is_configured ? "outline" : "default"}
                disabled={p.status === "soon"}
                onClick={() => onConfigure(p)}
                className="w-full"
              >
                {p.status === "soon" ? "Em breve" : h?.is_configured ? "Gerenciar" : "Conectar"}
                {p.status !== "soon" && <ArrowRight className="h-3.5 w-3.5 ml-1.5" />}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function providerIcon(p: ErpProviderCatalog) {
  if (p.category === "cloud") return <Cloud className="h-4 w-4 text-muted-foreground" />;
  if (p.category === "on-premise") return <Server className="h-4 w-4 text-muted-foreground" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

function labelMethod(m: string): string {
  return ({ api: "API", db: "DB", agent: "Agente", csv: "CSV", xml: "XML" } as any)[m] ?? m;
}

function ProviderStatusBadge({
  provider, health,
}: { provider: ErpProviderCatalog; health?: { status: string; is_configured: boolean } }) {
  if (provider.status === "soon") return <Badge variant="secondary">Em breve</Badge>;
  if (!health?.is_configured) return <Badge variant="outline">Não configurado</Badge>;
  if (health.status === "online") return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Online</Badge>;
  if (health.status === "degraded") return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Degradado</Badge>;
  if (health.status === "offline") return <Badge variant="destructive">Offline</Badge>;
  return <Badge variant="outline">Inativo</Badge>;
}

// ============================================================================
// Health
// ============================================================================

function HealthTab({ orgId }: { orgId: string | null }) {
  const getHealth = useServerFn(getErpHealth);
  const qc = useQueryClient();
  const { data, isFetching } = useQuery({
    queryKey: ["erp-health", orgId],
    queryFn: () => getHealth({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 60_000,
  });

  const rows = data?.rows ?? [];
  const configured = rows.filter((r) => r.is_configured);
  const online = configured.filter((r) => r.status === "online").length;
  const issues = configured.filter((r) => r.status === "degraded" || r.status === "offline").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="ERPs conectados" value={configured.length} icon={<Plug className="h-4 w-4" />} />
        <KpiCard label="Online" value={online} icon={<Wifi className="h-4 w-4 text-emerald-500" />} />
        <KpiCard label="Com problemas" value={issues} icon={<WifiOff className="h-4 w-4 text-amber-500" />} tone={issues > 0 ? "warn" : "default"} />
        <KpiCard
          label="Última checagem"
          value={isFetching ? "Atualizando…" : "Agora"}
          icon={<RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />}
        />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Status por provedor</h3>
        <Button size="sm" variant="outline"
          onClick={() => qc.invalidateQueries({ queryKey: ["erp-health", orgId] })}
          disabled={isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Re-checar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {rows.map((r) => {
              const cat = ERP_CATALOG.find((c) => c.id === r.provider)!;
              const pct = r.contacts_total ? Math.round((r.contacts_synced / r.contacts_total) * 100) : 0;
              return (
                <div key={r.provider} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-3 flex items-center gap-2">
                    {providerIcon(cat)}
                    <div>
                      <div className="font-medium text-sm">{cat.name}</div>
                      <div className="text-xs text-muted-foreground">{cat.category}</div>
                    </div>
                  </div>
                  <div className="md:col-span-2"><ProviderStatusBadge provider={cat} health={r} /></div>
                  <div className="md:col-span-2 text-xs">
                    <div className="text-muted-foreground">Latência</div>
                    <div className="font-medium">{r.latency_ms != null ? `${r.latency_ms}ms` : "—"}</div>
                  </div>
                  <div className="md:col-span-2 text-xs">
                    <div className="text-muted-foreground">Última sync</div>
                    <div className="font-medium">{r.last_sync_at ? new Date(r.last_sync_at).toLocaleString("pt-BR") : "Nunca"}</div>
                  </div>
                  <div className="md:col-span-3 text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Cobertura</span>
                      <span className="font-medium">{r.contacts_synced + r.companies_synced} / {r.contacts_total + r.companies_total}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                  {r.last_error && (
                    <div className="md:col-span-12 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-destructive shrink-0" />
                      <span className="text-destructive">{r.last_error}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon, tone = "default" }: {
  label: string; value: number | string; icon: React.ReactNode; tone?: "default" | "warn";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className={`text-2xl font-semibold mt-1 ${tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CSV Import — universal
// ============================================================================

type CsvEntity = "contacts" | "companies" | "products";

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Parser simples — suporta vírgula ou ;, e aspas duplas
  const sep = (text.split("\n")[0] ?? "").includes(";") ? ";" : ",";
  const lines: string[][] = [];
  let cur: string[] = [];
  let buf = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === sep && !inQ) { cur.push(buf); buf = ""; continue; }
    if ((c === "\n" || c === "\r") && !inQ) {
      if (buf.length || cur.length) { cur.push(buf); lines.push(cur); cur = []; buf = ""; }
      if (c === "\r" && text[i+1] === "\n") i++;
      continue;
    }
    buf += c;
  }
  if (buf.length || cur.length) { cur.push(buf); lines.push(cur); }
  const headers = (lines.shift() ?? []).map((h) => h.trim());
  const rows = lines
    .filter((l) => l.some((v) => v.trim().length))
    .map((l) => Object.fromEntries(headers.map((h, i) => [h, (l[i] ?? "").trim()])));
  return { headers, rows };
}

function CsvImportTab({ orgId }: { orgId: string | null }) {
  const [entity, setEntity] = useState<CsvEntity>("contacts");
  const [parsed, setParsed] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [targets, setTargets] = useState<string[]>([]);
  const [result, setResult] = useState<{ inserted: number; duplicates: number; errors: number; errorSamples: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const preview = useServerFn(previewCsvImport);
  const run = useServerFn(runCsvImport);

  const previewMut = useMutation({
    mutationFn: (h: string[]) => preview({ data: { entity, headers: h } }),
    onSuccess: (r) => { setMapping(r.suggested); setTargets(r.targets); },
  });

  const runMut = useMutation({
    mutationFn: () => run({
      data: { organization_id: orgId!, entity, mapping, rows: parsed!.rows },
    }),
    onSuccess: (r) => { setResult(r); toast.success(`${r.inserted} importados, ${r.duplicates} duplicados, ${r.errors} erros`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onFile = async (f: File) => {
    const text = await f.text();
    const p = parseCsv(text);
    if (!p.headers.length) { toast.error("CSV vazio ou inválido"); return; }
    setParsed(p);
    setResult(null);
    previewMut.mutate(p.headers);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar de qualquer ERP via CSV</CardTitle>
          <CardDescription>
            Exporte uma planilha do seu ERP (Excel ou CSV) e arraste aqui. A IA sugere o mapeamento;
            você ajusta e importa. Suporta vírgula ou ponto-e-vírgula como separador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Importar para</Label>
              <Select value={entity} onValueChange={(v) => { setEntity(v as CsvEntity); setParsed(null); setResult(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contacts">Contatos</SelectItem>
                  <SelectItem value="companies">Empresas</SelectItem>
                  <SelectItem value="products">Produtos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Arquivo CSV</Label>
              <Input ref={inputRef} type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            </div>
          </div>

          {parsed && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Mapeamento de colunas</div>
                  <Badge variant="outline" className="text-xs">{parsed.rows.length} linhas detectadas</Badge>
                </div>
                <div className="rounded-md border divide-y text-sm max-h-72 overflow-y-auto">
                  {parsed.headers.map((h) => (
                    <div key={h} className="p-2 grid grid-cols-12 gap-2 items-center">
                      <code className="col-span-5 text-xs text-muted-foreground truncate" title={h}>{h}</code>
                      <ArrowRight className="col-span-1 h-3 w-3 text-muted-foreground mx-auto" />
                      <div className="col-span-6">
                        <Select
                          value={mapping[h] ?? "__skip"}
                          onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v === "__skip" ? "" : v }))}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__skip">— ignorar —</SelectItem>
                            {targets.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={() => runMut.mutate()} disabled={runMut.isPending || !orgId}>
                  {runMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Importar {parsed.rows.length} linhas
                </Button>
                <Button variant="ghost" onClick={() => { setParsed(null); setResult(null); if (inputRef.current) inputRef.current.value = ""; }}>
                  Limpar
                </Button>
              </div>
            </>
          )}

          {result && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
              <div className="font-medium flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Importação concluída</div>
              <div className="text-xs text-muted-foreground">
                {result.inserted} novos • {result.duplicates} duplicados pulados • {result.errors} com erro
              </div>
              {result.errorSamples.length > 0 && (
                <ul className="text-xs text-destructive mt-2 list-disc list-inside">
                  {result.errorSamples.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Webhook universal
// ============================================================================

function WebhookTab({ orgId }: { orgId: string | null }) {
  const list = useServerFn(listInboundLog);
  const { data } = useQuery({
    queryKey: ["erp-inbound", orgId],
    queryFn: () => list({ data: { organization_id: orgId!, limit: 30 } }),
    enabled: !!orgId,
    refetchInterval: 30_000,
  });
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/hooks/erp-inbound`;
  const sample = `curl -X POST ${url} \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"provider":"meu-erp","entity":"contacts","external_id":"123","data":{"name":"Acme","email":"a@b.com"}}'`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Webhook className="h-4 w-4" /> Endpoint universal</CardTitle>
          <CardDescription>
            Qualquer ERP pode postar aqui. Use um token de agente (Configurações → ERP Agent) para autenticar.
            O mapeamento de campos definido em "Mapeamentos" será aplicado antes do upsert.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("URL copiada"); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Exemplo</Label>
            <pre className="rounded-md border bg-muted/30 p-3 text-xs overflow-x-auto">{sample}</pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos eventos recebidos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!data?.events.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhum evento ainda.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.events.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{new Date(e.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-xs">{e.provider}</TableCell>
                    <TableCell className="text-xs">{e.entity}</TableCell>
                    <TableCell className="text-xs font-mono">{e.external_id ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={e.status === "rejected" ? "destructive" : "outline"} className="text-xs">{e.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Mapeamentos — CRUD real
// ============================================================================

function MappingsTab({ orgId }: { orgId: string | null }) {
  const list = useServerFn(listFieldMappings);
  const save = useServerFn(upsertFieldMapping);
  const del = useServerFn(deleteFieldMapping);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["erp-mappings", orgId],
    queryFn: () => list({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const [provider, setProvider] = useState<ProviderId>("custom");
  const [entity, setEntity] = useState<"contacts" | "companies" | "products">("contacts");
  const [src, setSrc] = useState("");
  const [tgt, setTgt] = useState("");
  const [tr, setTr] = useState<"none"|"trim"|"uppercase"|"lowercase"|"digits_only"|"cnpj_mask">("none");

  const saveMut = useMutation({
    mutationFn: () => save({ data: { organization_id: orgId!, provider, entity, source_field: src, target_field: tgt, transform: tr } }),
    onSuccess: () => { toast.success("Mapeamento salvo"); setSrc(""); setTgt(""); qc.invalidateQueries({ queryKey: ["erp-mappings", orgId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["erp-mappings", orgId] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo mapeamento</CardTitle>
          <CardDescription>De → para entre o campo do ERP (origem) e o campo do CRM (destino), com transformação opcional.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-6 gap-2 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">ERP</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as ProviderId)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="omie">Omie</SelectItem>
                <SelectItem value="bling">Bling</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Entidade</Label>
            <Select value={entity} onValueChange={(v) => setEntity(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contacts">contacts</SelectItem>
                <SelectItem value="companies">companies</SelectItem>
                <SelectItem value="products">products</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Campo ERP</Label>
            <Input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="razao_social" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Campo CRM</Label>
            <Input value={tgt} onChange={(e) => setTgt(e.target.value)} placeholder="name" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Transformação</Label>
            <Select value={tr} onValueChange={(v) => setTr(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">nenhuma</SelectItem>
                <SelectItem value="trim">trim</SelectItem>
                <SelectItem value="uppercase">UPPERCASE</SelectItem>
                <SelectItem value="lowercase">lowercase</SelectItem>
                <SelectItem value="digits_only">só dígitos</SelectItem>
                <SelectItem value="cnpj_mask">máscara CNPJ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={!src || !tgt || saveMut.isPending}>
            {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Mapeamentos configurados</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!data?.mappings.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhum mapeamento ainda. Crie acima.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ERP</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Transform</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.mappings.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs"><Badge variant="outline">{m.provider}</Badge></TableCell>
                    <TableCell className="text-xs">{m.entity}</TableCell>
                    <TableCell className="text-xs font-mono">{m.source_field}</TableCell>
                    <TableCell className="text-xs font-mono text-primary">{m.target_field}</TableCell>
                    <TableCell className="text-xs">{m.transform ?? "none"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => delMut.mutate(m.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Wizard — Omie / Bling / Custom
// ============================================================================

type CredCfg = {
  needsCreds: boolean;
  keyLabel: string;
  keyPlaceholder: string;
  secretLabel?: string;
  secretPlaceholder?: string;
  docsHint?: string;
};

function credConfig(p: ProviderId): CredCfg {
  if (p === "omie") return { needsCreds: true, keyLabel: "App Key", keyPlaceholder: "000000000000", secretLabel: "App Secret", secretPlaceholder: "••••••••" };
  if (p === "bling") return { needsCreds: true, keyLabel: "Access Token", keyPlaceholder: "Cole o access token gerado no Bling", secretLabel: "Refresh Token (opcional)", secretPlaceholder: "Para renovação automática" };
  return { needsCreds: false, keyLabel: "", keyPlaceholder: "" };
}

const WIZARD_STEPS = ["Provedor","Método","Credenciais","Testar","Sincronizar"] as const;

function ConnectWizard({
  provider, orgId, onClose,
}: { provider: ErpProviderCatalog; orgId: string | null; onClose: () => void }) {
  const pid = provider.id as ProviderId;
  const cred = credConfig(pid);

  const [step, setStep] = useState(0);
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [active, setActive] = useState(true);
  const [testResult, setTestResult] = useState<null | "ok" | "fail">(null);
  const [testError, setTestError] = useState<string | null>(null);

  const qc = useQueryClient();
  const getIntegration = useServerFn(getErpIntegration);
  const save = useServerFn(saveErpIntegration);
  const remove = useServerFn(deleteErpIntegration);
  const testOmie = useServerFn(testErpConnection);
  const testBling = useServerFn(testBlingConnection);
  const importBlingContacts = useServerFn(importContactsFromBling);

  const { data: integData } = useQuery({
    queryKey: ["erp-integration", orgId, pid],
    queryFn: () => getIntegration({ data: { organization_id: orgId!, provider: pid } }),
    enabled: !!orgId && cred.needsCreds,
  });

  useEffect(() => {
    if (integData?.integration) {
      setAppKey(integData.integration.app_key);
      setAppSecret(integData.integration.app_secret);
      setActive(integData.integration.is_active);
    }
  }, [integData?.integration?.id]);

  const saveMut = useMutation({
    mutationFn: () => save({
      data: { organization_id: orgId!, provider: pid, app_key: appKey, app_secret: appSecret || appKey, is_active: active },
    }),
    onSuccess: () => {
      toast.success("Credenciais salvas");
      qc.invalidateQueries({ queryKey: ["erp-integration", orgId, pid] });
      qc.invalidateQueries({ queryKey: ["erp-health", orgId] });
      setStep(3);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: () =>
      pid === "omie" ? testOmie({ data: { organization_id: orgId! } })
      : pid === "bling" ? testBling({ data: { organization_id: orgId! } })
      : Promise.resolve({ ok: true }),
    onSuccess: () => { setTestResult("ok"); setTestError(null); toast.success("Conexão validada"); },
    onError: (e: Error) => { setTestResult("fail"); setTestError(e.message); },
  });

  const importMut = useMutation({
    mutationFn: () => importBlingContacts({ data: { organization_id: orgId!, limit: 50 } }),
    onSuccess: (r) => toast.success(`${r.inserted} contatos importados (${r.skipped} pulados)`),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: () => remove({ data: { organization_id: orgId!, provider: pid } }),
    onSuccess: () => {
      toast.success("Integração removida");
      setAppKey(""); setAppSecret("");
      qc.invalidateQueries({ queryKey: ["erp-integration", orgId, pid] });
      qc.invalidateQueries({ queryKey: ["erp-health", orgId] });
      onClose();
    },
  });

  const progress = useMemo(() => Math.round(((step + 1) / WIZARD_STEPS.length) * 100), [step]);
  const integ = integData?.integration;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {providerIcon(provider)} Conectar {provider.name}
        </SheetTitle>
        <SheetDescription>{provider.description}</SheetDescription>
      </SheetHeader>

      <div className="mt-4 space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Passo {step + 1} de {WIZARD_STEPS.length}: <strong className="text-foreground">{WIZARD_STEPS[step]}</strong></span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="mt-6 space-y-4 min-h-[300px]">
        {step === 0 && (
          <div className="space-y-3">
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="text-sm font-medium">{provider.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{provider.description}</div>
              <Badge variant="outline" className="mt-2 text-[10px]">{provider.category}</Badge>
            </div>
            {provider.docsUrl && (
              <a href={provider.docsUrl} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Documentação oficial <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <Label>Método de conexão</Label>
            {provider.methods.map((m) => (
              <div key={m} className="w-full text-left rounded-md border p-3 text-sm bg-muted/30">
                <div className="font-medium">{labelMethod(m)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {m === "api" && "Conexão direta via API REST do ERP."}
                  {m === "db" && "Leitura direta no banco de dados (apenas on-premise)."}
                  {m === "agent" && "Agente local instalado na rede do cliente."}
                  {m === "csv" && "Use a aba 'Importar CSV' do hub."}
                  {m === "xml" && "Importação de XML (NFe, pedidos, cadastros)."}
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {!cred.needsCreds ? (
              <div className="rounded-md border bg-muted/30 p-4 space-y-2 text-sm">
                <div className="font-medium flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> ERP customizado</div>
                <p className="text-xs text-muted-foreground">
                  Para conectar um ERP qualquer, use uma das duas vias:
                </p>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                  <li>Aba <strong>Importar CSV</strong> — exporte uma planilha do seu ERP.</li>
                  <li>Aba <strong>Webhook universal</strong> — endpoint REST que aceita JSON.</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  Configure o mapeamento de campos na aba <strong>Mapeamentos</strong>.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="app_key">{cred.keyLabel}</Label>
                  <Input id="app_key" value={appKey} onChange={(e) => setAppKey(e.target.value)} placeholder={cred.keyPlaceholder} />
                </div>
                {cred.secretLabel && (
                  <div className="space-y-2">
                    <Label htmlFor="app_secret">{cred.secretLabel}</Label>
                    <Input id="app_secret" type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder={cred.secretPlaceholder} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Switch id="active" checked={active} onCheckedChange={setActive} />
                  <Label htmlFor="active">Integração ativa</Label>
                </div>
                {provider.docsUrl && (
                  <a href={provider.docsUrl} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    Onde gerar as chaves <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            {cred.needsCreds ? (
              <>
                <Button
                  onClick={() => testMut.mutate()}
                  disabled={!integ || testMut.isPending}
                  className="w-full"
                >
                  {testMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Testar conexão
                </Button>
                {testResult === "ok" && (
                  <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                    <div>
                      <div className="font-medium text-emerald-700 dark:text-emerald-400">Conexão validada</div>
                      <div className="text-xs text-muted-foreground">Pronto para sincronizar.</div>
                    </div>
                  </div>
                )}
                {testResult === "fail" && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div>
                      <div className="font-medium text-destructive">Falhou</div>
                      <div className="text-xs text-muted-foreground">{testError}</div>
                    </div>
                  </div>
                )}
                {!integ && <p className="text-xs text-muted-foreground">Salve as credenciais antes de testar.</p>}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Sem credenciais para testar — vá para Sincronizar.</div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            {pid === "bling" && integ && (
              <Button onClick={() => importMut.mutate()} disabled={importMut.isPending} className="w-full">
                {importMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importar 50 contatos do Bling agora
              </Button>
            )}
            {pid === "omie" && (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                <div className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Pronto para sincronizar
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Use os botões "Enviar ao Omie" na ficha do contato ou empresa.
                </div>
              </div>
            )}
            {!cred.needsCreds && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                Use as abas <strong>Importar CSV</strong> ou <strong>Webhook universal</strong> do hub para enviar dados.
              </div>
            )}
            {integ?.last_sync_at && (
              <div className="text-xs text-muted-foreground">
                Última sincronização: {new Date(integ.last_sync_at).toLocaleString("pt-BR")}
              </div>
            )}
            {integ && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                onClick={() => removeMut.mutate()}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remover integração
              </Button>
            )}
          </div>
        )}
      </div>

      <Separator className="my-6" />

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Voltar
        </Button>
        <div className="flex gap-2">
          {step === 2 && cred.needsCreds && (
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={!appKey || saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Salvar e avançar
            </Button>
          )}
          {!(step === 2 && cred.needsCreds) && step < WIZARD_STEPS.length - 1 && (
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>Avançar</Button>
          )}
          {step === WIZARD_STEPS.length - 1 && (
            <Button size="sm" onClick={onClose}>Concluir</Button>
          )}
        </div>
      </div>
    </>
  );
}
