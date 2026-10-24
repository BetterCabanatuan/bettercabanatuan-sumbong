import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteRole, saveRole } from "@/app/v/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ActionFieldError, ActionForm, SubmitButton } from "@/components/volunteer/action-form";
import { PermissionMatrix } from "@/components/volunteer/permission-matrix";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Permission, PermissionInfo } from "@/lib/types";

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  role_permissions: { permission: Permission }[];
};

export default async function RolePage({ params, searchParams }: PageProps<"/v/settings/roles/[id]">) {
  const { id } = await params;
  const isNew = id === "new";
  const me = await requirePermission(isNew ? "roles.add" : "roles.view");
  const query = await searchParams;

  const supabase = await createClient();
  const [{ data: permissionRows }, { data: roleRow }, { data: memberRows }] = await Promise.all([
    supabase.from("permissions").select("key, resource, action, label, description, sort_order").order("sort_order"),
    isNew
      ? Promise.resolve({ data: null })
      : supabase.from("roles").select("id, name, description, role_permissions(permission)").eq("id", id).maybeSingle<RoleRow>(),
    isNew
      ? Promise.resolve({ data: [] })
      : supabase.from("volunteers").select("user_id, display_name").eq("role_id", id).eq("active", true).order("display_name"),
  ]);
  if (!isNew && !roleRow) notFound();

  const permissions = (permissionRows ?? []) as PermissionInfo[];
  const members = (memberRows ?? []) as { user_id: string; display_name: string }[];
  const editable = isNew ? can(me, "roles.add") : can(me, "roles.edit");
  const isMine = roleRow?.id === me.role_id;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="self-start" nativeButton={false} render={<Link href="/v/settings/roles" />}>
          <ArrowLeft data-icon="inline-start" />
          Roles
        </Button>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-navy">
          {isNew ? "New role" : roleRow!.name}
          {isMine && <Badge variant="outline">Your role</Badge>}
        </h1>
      </div>
      {query.saved && (
        <Alert>
          <AlertDescription>Saved.</AlertDescription>
        </Alert>
      )}
      {isMine && editable && (
        <Alert>
          <AlertDescription>
            This is your own role. Changes apply to you at once, and someone active must keep “Edit roles”.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <ActionForm schema="role" action={saveRole} className="contents">
          {roleRow && <input type="hidden" name="id" value={roleRow.id} />}
          <CardHeader>
            <CardTitle>Role</CardTitle>
            {!editable && <CardDescription>You can view this role but not change it.</CardDescription>}
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FieldGroup className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <Field>
                <FieldLabel htmlFor="role-name">Name</FieldLabel>
                <Input id="role-name" name="name" defaultValue={roleRow?.name} maxLength={60} required disabled={!editable} />
                <ActionFieldError name="name" />
              </Field>
              <Field>
                <FieldLabel htmlFor="role-description">Description</FieldLabel>
                <Input id="role-description" name="description" defaultValue={roleRow?.description ?? ""} disabled={!editable} />
                <ActionFieldError name="description" />
              </Field>
            </FieldGroup>
            <PermissionMatrix
              permissions={permissions}
              defaultSelected={roleRow?.role_permissions.map((p) => p.permission) ?? ["reports.view", "digests.view"]}
              disabled={!editable}
            />
          </CardContent>
          {editable && (
            <CardFooter className="gap-2">
              <SubmitButton>{isNew ? "Create role" : "Save role"}</SubmitButton>
              <Button variant="ghost" nativeButton={false} render={<Link href="/v/settings/roles" />}>
                Cancel
              </Button>
            </CardFooter>
          )}
        </ActionForm>
      </Card>

      {roleRow && (
        <Card>
          <CardHeader>
            <CardTitle>People with this role</CardTitle>
            <CardDescription>
              {members.length === 0 ? "Nobody has this role." : `${members.length} active.`} Change someone’s role under{" "}
              <Link href="/v/settings/users" className="text-primary underline">
                Users
              </Link>
              .
            </CardDescription>
          </CardHeader>
          {members.length > 0 && (
            <CardContent>
              <ul className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <li key={m.user_id}>
                    <Badge variant="secondary">{m.display_name}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {roleRow && can(me, "roles.delete") && (
        <Card>
          <CardHeader>
            <CardTitle>Delete role</CardTitle>
            <CardDescription>
              {members.length > 0
                ? "Give everyone with this role another role first."
                : "Deleting can’t be undone. Pending invitations with this role must be cancelled or changed first."}
            </CardDescription>
          </CardHeader>
          {members.length === 0 && (
            <CardFooter>
              <ActionForm action={deleteRole.bind(null, roleRow.id)} className="flex flex-col items-start gap-3">
                <SubmitButton variant="destructive">Delete “{roleRow.name}”</SubmitButton>
              </ActionForm>
            </CardFooter>
          )}
        </Card>
      )}
    </>
  );
}
