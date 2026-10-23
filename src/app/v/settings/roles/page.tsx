import { Plus } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataView } from "@/components/volunteer/data-view";
import { ListHeader } from "@/components/volunteer/list-header";
import { can, requirePermission } from "@/lib/auth";
import { resolveView } from "@/lib/data-view";
import { PERMISSION_AREAS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

type RoleRow = Omit<Role, "permissions"> & { role_permissions: { permission: Role["permissions"][number] }[] };
type RoleItem = Role & { people: number };

/** "Reports: 4 · Digests: 7", in matrix order. */
function accessSummary(role: Role) {
  const parts = PERMISSION_AREAS.map((area) => {
    const count = role.permissions.filter((p) => p.startsWith(`${area.key}.`)).length;
    return count ? `${area.label} ${count}` : null;
  }).filter(Boolean);
  return parts.length ? parts.join(" · ") : "No access";
}

export default async function RolesPage({ searchParams }: PageProps<"/v/settings/roles">) {
  const me = await requirePermission("roles.view");
  const query = await searchParams;
  const view = resolveView("roles", query, await cookies());
  const supabase = await createClient();
  const [{ data: roleRows }, { count: total }, { data: members }] = await Promise.all([
    supabase.from("roles").select("id, name, description, role_permissions(permission)").order("name"),
    supabase.from("permissions").select("key", { count: "exact", head: true }),
    supabase.from("volunteers").select("role_id").eq("active", true),
  ]);
  const people = new Map<string, number>();
  for (const { role_id } of (members ?? []) as { role_id: string }[]) people.set(role_id, (people.get(role_id) ?? 0) + 1);
  const roles: RoleItem[] = ((roleRows ?? []) as RoleRow[]).map(({ role_permissions, ...role }) => ({
    ...role,
    permissions: role_permissions.map((p) => p.permission),
    people: people.get(role.id) ?? 0,
  }));

  return (
    <>
      <ListHeader
        title="Roles"
        description="A role is a set of permissions: what someone can view, add, edit, delete, archive, print or export in each area. Give people roles under Users."
        screen="roles"
        view={view}
      >
        {can(me, "roles.add") && (
          <Button nativeButton={false} render={<Link href="/v/settings/roles/new" />}>
            <Plus data-icon="inline-start" />
            New role
          </Button>
        )}
      </ListHeader>
      {query.deleted && (
        <Alert>
          <AlertDescription>Role deleted.</AlertDescription>
        </Alert>
      )}
      <DataView
        view={view}
        items={roles}
        itemKey={(role) => role.id}
        titleLabel="Role"
        title={(role) => role.name}
        href={(role) => `/v/settings/roles/${role.id}`}
        subtitle={(role) => role.description}
        badges={(role) => role.id === me.role_id && <Badge variant="outline">Your role</Badge>}
        fields={[
          {
            key: "permissions",
            label: "Permissions",
            numeric: true,
            value: (role) => `${role.permissions.length} of ${total ?? 0}`,
          },
          { key: "access", label: "Access", value: accessSummary, hideInList: true },
          {
            key: "people",
            label: "People",
            numeric: true,
            value: (role) => (role.people === 1 ? "1 person" : `${role.people} people`),
          },
        ]}
        actions={(role) => (
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/v/settings/roles/${role.id}`} />}>
            {can(me, "roles.edit") ? "Edit" : "View"}
          </Button>
        )}
        empty="No roles yet."
      />
    </>
  );
}
