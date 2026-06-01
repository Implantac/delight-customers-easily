import { useCurrentOrg } from "@/lib/org";

/**
 * Hierarquia de papéis (do mais alto para o mais baixo):
 *   owner > admin > manager > sales_rep > member
 *
 * - owner   — controle total da organização (transferir, excluir, billing)
 * - admin   — configurações, convites, webhooks, integrações
 * - manager — gerente comercial; vê a equipe inteira, edita metas, aprova
 * - sales_rep — representante; vê e edita apenas o que está atribuído a ele
 * - member  — papel genérico legado (somente leitura ampla)
 */
export type OrgRole = "owner" | "admin" | "manager" | "sales_rep" | "member";

const RANK: Record<OrgRole, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  sales_rep: 40,
  member: 20,
};

export function roleAtLeast(role: OrgRole | null | undefined, min: OrgRole): boolean {
  if (!role) return false;
  return (RANK[role] ?? 0) >= RANK[min];
}

/** owner ou admin: pode gerenciar configurações, convidar, editar campos, webhooks. */
export function useCanManage() {
  const { role } = useCurrentOrg();
  return roleAtLeast(role as OrgRole | null, "admin");
}

/** apenas owner: pode transferir/excluir a organização. */
export function useIsOwner() {
  const { role } = useCurrentOrg();
  return role === "owner";
}

/** manager ou superior: pode ver dados da equipe inteira e aprovar. */
export function useIsManager() {
  const { role } = useCurrentOrg();
  return roleAtLeast(role as OrgRole | null, "manager");
}

/** sales_rep ou superior: tem acesso operacional ao pipeline. */
export function useIsSalesRep() {
  const { role } = useCurrentOrg();
  return roleAtLeast(role as OrgRole | null, "sales_rep");
}

export function roleLabel(role: OrgRole | null): string {
  switch (role) {
    case "owner": return "Proprietário";
    case "admin": return "Administrador";
    case "manager": return "Gerente";
    case "sales_rep": return "Representante";
    case "member": return "Membro";
    default: return "—";
  }
}

export const ALL_ROLES: OrgRole[] = ["owner", "admin", "manager", "sales_rep", "member"];
