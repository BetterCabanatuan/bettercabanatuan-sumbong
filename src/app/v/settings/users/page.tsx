import { cookies } from "next/headers";
import Link from "next/link";
import { cancelInvitation, inviteVolunteer, setUserAccess } from "@/app/v/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ActionFieldError, ActionForm, SubmitButton } from "@/components/volunteer/action-form";
import { DataView } from "@/components/volunteer/data-view";
import { ListHeader } from "@/components/volunteer/list-header";
import { type VolunteerAccess, can, requirePermission } from "@/lib/auth";
import { resolveView } from "@/lib/data-view";
import { createClient } from "@/lib/supabase/server";
import type { UserAccount, VolunteerInvitation } from "@/lib/types";

const PAGE_SIZE = 50;

function day(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" }) : "Never";
}

export default async function UsersPage({ searchParams }: PageProps<"/v/settings/users">) {
  const me = await requirePermission("users.view");
  const params = await searchParams;
  const view = resolveView("users", params, await cookies());
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const all = params.show === "all";
  const page = Math.max(1, Number(params.page) || 1);

  const supabase = await createClient();
  const [{ data: users }, { data: roles }, { data: invitations }] = await Promise.all([
    supabase.rpc("list_users", {
      p_search: q || null,
      p_staff_only: !all,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
    supabase.from("roles").select("id, name").order("name"),
    supabase.from("volunteer_invitations").select("email, role_id, display_name, created_at").order("created_at"),
  ]);
  const accounts = (users ?? []) as UserAccount[];
  const roleList = (roles ?? []) as { id: string; name: string }[];
  const roleNames = new Map(roleList.map((r) => [r.id, r.name]));
  const pending = (invitations ?? []) as VolunteerInvitation[];
  const total = Number(accounts[0]?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const search = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams();
    const merged = { q: q || null, show: all ? "all" : null, page: page > 1 ? page : null, ...changes };
    for (const [key, value] of Object.entries(merged)) if (value !== null && value !== "") next.set(key, String(value));
    return next.toString();
  };
  const href = (changes: Record<string, string | number | null>) => {
    const query = search(changes);
    return `/v/settings/users${query ? `?${query}` : ""}`;
  };

  return (
    <>
      <ListHeader
        title="Users"
        description={
          <>
            Everyone who has signed in. A role gives someone the Volunteer console; what they can do there is set under{" "}
            <Link href="/v/settings/roles" className="text-primary underline">
              Roles
            </Link>
            . Residents can sign in without a role to see their own Reports.
          </>
        }
        screen="users"
        view={view}
        exportHref={can(me, "users.export") ? `/v/settings/users/export?${search({ page: null })}` : null}
      />

      {can(me, "users.add") && (
        <Card>
          <CardHeader>
            <CardTitle>Invite someone</CardTitle>
            <CardDescription>
              They get an email to sign in. The role applies once they confirm their address; accounts with a
              confirmed address get it at once.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm schema="invite" action={inviteVolunteer} success="Invited." className="flex flex-col gap-4">
              <FieldGroup className="grid items-end gap-4 sm:grid-cols-[2fr_2fr_1fr_auto]">
                <Field>
                  <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                  <Input id="invite-email" name="email" type="email" required />
                  <ActionFieldError name="email" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="invite-name">Display name</FieldLabel>
                  <Input id="invite-name" name="display_name" />
                  <ActionFieldError name="display_name" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="invite-role">Role</FieldLabel>
                  <NativeSelect id="invite-role" name="role_id" defaultValue={roleList.find((r) => r.name === "Volunteer")?.id}>
                    {roleList.map((role) => (
                      <NativeSelectOption key={role.id} value={role.id}>
                        {role.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <SubmitButton>Invite</SubmitButton>
              </FieldGroup>
            </ActionForm>
          </CardContent>
        </Card>
      )}

      {pending.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="pending-heading">
          <div>
            <h2 id="pending-heading" className="text-lg font-semibold">
              Waiting to sign in
            </h2>
            <p className="text-sm text-muted-foreground">Invitations waiting for the address to be confirmed.</p>
          </div>
          <DataView
            view={view}
            items={pending}
            itemKey={(invitation) => invitation.email}
            titleLabel="Email"
            title={(invitation) => invitation.email}
            subtitle={(invitation) => invitation.display_name}
            fields={[
              { key: "role", label: "Role", value: (invitation) => roleNames.get(invitation.role_id) },
              { key: "invited", label: "Invited", value: (invitation) => day(invitation.created_at) },
            ]}
            actions={
              can(me, "users.add")
                ? (invitation) => (
                    <ActionForm action={cancelInvitation.bind(null, invitation.email)}>
                      <SubmitButton variant="ghost">Cancel</SubmitButton>
                    </ActionForm>
                  )
                : undefined
            }
            empty="No invitations."
          />
        </section>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <nav className="flex gap-1" aria-label="Which accounts">
          <Button variant={all ? "ghost" : "secondary"} size="sm" nativeButton={false} render={<Link href={href({ show: null, page: null })} />}>
            Volunteers
          </Button>
          <Button variant={all ? "secondary" : "ghost"} size="sm" nativeButton={false} render={<Link href={href({ show: "all", page: null })} />}>
            All accounts
          </Button>
        </nav>
        <form method="get" className="flex items-end gap-2">
          {all && <input type="hidden" name="show" value="all" />}
          <Field>
            <FieldLabel htmlFor="user-search" className="sr-only">
              Search by email or name
            </FieldLabel>
            <Input id="user-search" name="q" type="search" placeholder="Search by email or name" defaultValue={q} />
          </Field>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      <DataView
        view={view}
        items={accounts}
        itemKey={(account) => account.user_id}
        titleLabel="Account"
        title={(account) => account.display_name ?? account.email}
        subtitle={(account) => account.display_name && account.email}
        badges={(account) => (
          <>
            {account.user_id === me.user_id && <Badge variant="outline">You</Badge>}
            {account.active ? (
              <Badge variant="secondary">{account.role_name}</Badge>
            ) : account.role_name ? (
              <Badge variant="outline">No access</Badge>
            ) : null}
          </>
        )}
        fields={[
          { key: "joined", label: "Joined", value: (account) => day(account.created_at) },
          { key: "last", label: "Last sign-in", value: (account) => day(account.last_sign_in_at) },
        ]}
        actionsLabel="Role and access"
        actions={(account) => <AccessControl account={account} me={me} roles={roleList} />}
        empty={q ? "Nobody matches." : "No accounts yet."}
      />

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Pages">
          {page > 1 ? (
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href({ page: page - 1 })} />}>
              Previous
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {pages} · {total} accounts
          </span>
          {page < pages ? (
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href({ page: page + 1 })} />}>
              Next
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

/**
 * The role picker for one account, offering only what the viewer's role allows: giving a
 * role to an account without access is Add, changing an active role is Edit, and "No access" is Archive.
 */
function AccessControl({
  account,
  me,
  roles,
}: {
  account: UserAccount;
  me: VolunteerAccess;
  roles: { id: string; name: string }[];
}) {
  const current = account.active ? account.role_id : null;
  const canChangeRole = account.active ? can(me, "users.edit") : can(me, "users.add");
  const canRemove = account.active && can(me, "users.archive");
  if (account.user_id === me.user_id || (!canChangeRole && !canRemove)) return null;

  const choices = canChangeRole ? roles : roles.filter((role) => role.id === current);
  return (
    <ActionForm schema="userAccess" action={setUserAccess} success="Saved." className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="user_id" value={account.user_id} />
      <NativeSelect name="role_id" defaultValue={current ?? "none"} aria-label={`Role for ${account.display_name ?? account.email}`}>
        {(!account.active || canRemove) && (
          <NativeSelectOption value="none">
            {account.role_name && !account.active ? `No access (was ${account.role_name})` : "No access"}
          </NativeSelectOption>
        )}
        {choices.map((role) => (
          <NativeSelectOption key={role.id} value={role.id}>
            {role.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <SubmitButton variant="outline">Save</SubmitButton>
    </ActionForm>
  );
}
