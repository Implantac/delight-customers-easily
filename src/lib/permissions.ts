import { useCurrentOrg } from "@/lib/org";

export type OrgRole = "owner" | "admin" | "member";

/** owner ou admin: pode gerenciar configurações, convidar, editar campos, webhooks. */
export function useCanManage() {
  const { role } = useCurrentOrg();
  return role === "owner" || role === "admin";
}

/** apenas owner: pode transferir/excluir a organização. */
export function useIsOwner() {
  const { role } = useCurrentOrg();
  return role === "owner";
}

export function roleLabel(role: OrgRole | null): string {
  switch (role) {
    case "owner": return "Proprietário";
    case "admin": return "Administrador";
    case "member": return "Membro";
    default: return "—";
  }
}
