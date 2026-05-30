import { Link } from "@tanstack/react-router";
import { Plug, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Banner exibido no topo de toda tela "ERP — somente consulta".
 * O CRM não cria nem edita esses dados; eles vêm do ERP de origem
 * via Integrações. Qualquer alteração deve ser feita no ERP.
 */
export function ErpReadOnlyBanner({ entity }: { entity: string }) {
  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <Info className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between gap-3 text-xs">
        <span>
          <strong className="font-semibold">Origem: ERP.</strong> {entity} são
          sincronizados do seu ERP. O CRM exibe apenas para consulta —
          para criar, editar ou excluir, use o sistema de origem.
        </span>
        <Link
          to="/integrations"
          className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-primary hover:underline"
        >
          <Plug className="h-3 w-3" />
          Integrações
        </Link>
      </AlertDescription>
    </Alert>
  );
}
