import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import {
  listFieldMappings,
  upsertFieldMapping,
  deleteFieldMapping,
} from "@/lib/erp-mappings.functions";
import { suggestFieldMapping } from "@/lib/connect-hub-ai-suggest.functions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import {
  ArrowRight,
  Sparkles,
  Trash2,
  Plus,
  Loader2,
  GitBranch,
  Wand2,
} from "lucide-react";

export const Route = createFileRoute("/_app/integrations/mapping")({
  component: MappingScreen,
});

type Provider = "omie" | "bling" | "custom";
type Entity = "contacts" | "companies" | "products" | "orders";
type Transform =
  | "none"
  | "trim"
  | "uppercase"
  | "lowercase"
  | "digits_only"
  | "cnpj_mask";

const PROVIDERS: Array<{ id: Provider; label: string }> = [
  { id: "omie", label: "Omie" },
  { id: "bling", label: "Bling" },
  { id: "custom", label: "ERP customizado" },
];
const ENTITIES: Array<{ id: Entity; label: string }> = [
  { id: "companies", label: "Empresas/Clientes" },
  { id: "contacts", label: "Contatos" },
  { id: "products", label: "Produtos" },
  { id: "orders", label: "Pedidos" },
];
const TRANSFORMS: Transform[] = [
  "none",
  "trim",
  "uppercase",
  "lowercase",
  "digits_only",
  "cnpj_mask",
];

function MappingScreen() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const qc = useQueryClient();

  const [provider, setProvider] = useState<Provider>("omie");
  const [entity, setEntity] = useState<Entity>("companies");
  const [newSource, setNewSource] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newTransform, setNewTransform] = useState<Transform>("none");
  const [aiSample, setAiSample] = useState("");

  const fetchList = useServerFn(listFieldMappings);
  const upsert = useServerFn(upsertFieldMapping);
  const del = useServerFn(deleteFieldMapping);
  const aiSuggest = useServerFn(suggestFieldMapping);

  const mappings = useQuery({
    queryKey: ["field-mappings", orgId, provider, entity],
    queryFn: () =>
      fetchList({
        data: { organization_id: orgId!, provider, entity },
      }),
    enabled: !!orgId,
  });

  const upsertMut = useMutation({
    mutationFn: (vars: {
      source: string;
      target: string;
      transform: Transform;
    }) =>
      upsert({
        data: {
          organization_id: orgId!,
          provider,
          entity,
          source_field: vars.source,
          target_field: vars.target,
          transform: vars.transform,
        },
      }),
    onSuccess: () => {
      toast.success("Mapeamento salvo");
      setNewSource("");
      setNewTarget("");
      setNewTransform("none");
      qc.invalidateQueries({ queryKey: ["field-mappings"] });
    },
    onError: (e: any) =>
      toast.error("Falhou", { description: e?.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Mapeamento removido");
      qc.invalidateQueries({ queryKey: ["field-mappings"] });
    },
  });

  const aiMut = useMutation({
    mutationFn: () =>
      aiSuggest({
        data: {
          provider,
          entity,
          sample: aiSample || undefined,
        } as any,
      }),
    onSuccess: async (data: any) => {
      const suggestions = (data?.mappings ?? data?.suggestions ?? []) as Array<{
        source_field: string;
        target_field: string;
        transform?: Transform;
      }>;
      if (suggestions.length === 0) {
        toast.info("IA não encontrou sugestões novas.");
        return;
      }
      let saved = 0;
      for (const s of suggestions) {
        try {
          await upsert({
            data: {
              organization_id: orgId!,
              provider,
              entity,
              source_field: s.source_field,
              target_field: s.target_field,
              transform: s.transform ?? "none",
            },
          });
          saved++;
        } catch {
          /* skip individual failures */
        }
      }
      toast.success(`${saved} mapeamentos sugeridos pela IA aplicados.`);
      qc.invalidateQueries({ queryKey: ["field-mappings"] });
    },
    onError: (e: any) =>
      toast.error("IA indisponível", { description: e?.message }),
  });

  if (!canManage) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Sem acesso ao mapeamento de campos.
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = mappings.data?.mappings ?? [];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        icon={GitBranch}
        title="Mapeamento de campos"
        subtitle="Defina como os campos do ERP viram campos do CRM."
        action={
          <Link to="/integrations">
            <Button variant="ghost" size="sm">
              ← Voltar
            </Button>
          </Link>
        }
      />

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              ERP
            </Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as Provider)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Entidade
            </Label>
            <Select value={entity} onValueChange={(v) => setEntity(v as Entity)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITIES.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* IA sugestão */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Sugestão automática
            por IA
          </CardTitle>
          <CardDescription>
            Cole um exemplo de JSON do ERP (opcional). A IA mapeia
            automaticamente para os campos do CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={aiSample}
            onChange={(e) => setAiSample(e.target.value)}
            placeholder='{"razao_social":"Empresa LTDA","cnpj":"00.000.000/0000-00","email":"contato@x.com"}'
            className="w-full h-24 rounded-md border bg-background p-2 text-xs font-mono"
          />
          <Button
            onClick={() => aiMut.mutate()}
            disabled={aiMut.isPending}
            className="gap-2"
          >
            {aiMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {aiMut.isPending ? "Analisando..." : "Sugerir mapeamento com IA"}
          </Button>
        </CardContent>
      </Card>

      {/* Adicionar manual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Adicionar mapeamento manual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_auto] sm:items-end">
            <div className="space-y-1">
              <Label className="text-xs">Campo do ERP</Label>
              <Input
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder="razao_social"
              />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground mx-2 mb-3 hidden sm:block" />
            <div className="space-y-1">
              <Label className="text-xs">Campo do CRM</Label>
              <Input
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                placeholder="legal_name"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Transformação</Label>
              <Select
                value={newTransform}
                onValueChange={(v) => setNewTransform(v as Transform)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSFORMS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() =>
                upsertMut.mutate({
                  source: newSource,
                  target: newTarget,
                  transform: newTransform,
                })
              }
              disabled={
                !newSource || !newTarget || upsertMut.isPending
              }
              className="gap-2"
            >
              {upsertMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Mapeamentos atuais</CardTitle>
            <CardDescription>
              {rows.length} campo(s) configurado(s) para{" "}
              {PROVIDERS.find((p) => p.id === provider)?.label} /{" "}
              {ENTITIES.find((e) => e.id === entity)?.label}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {mappings.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Nenhum mapeamento ainda. Use a IA acima ou adicione
                manualmente.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campo ERP</TableHead>
                  <TableHead>Campo CRM</TableHead>
                  <TableHead>Transformação</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">
                      {m.source_field}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {m.target_field}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {m.transform}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMut.mutate(m.id)}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
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
