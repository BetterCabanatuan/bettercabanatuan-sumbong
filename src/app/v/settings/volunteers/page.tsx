import { inviteVolunteer, updateVolunteer } from "@/app/v/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionForm, SubmitButton } from "@/components/volunteer/action-form";
import { CheckboxField } from "@/components/volunteer/checkbox-field";
import { createClient } from "@/lib/supabase/server";
import type { Volunteer } from "@/lib/types";

export default async function VolunteersPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("volunteers").select("*").order("created_at");
  const volunteers = (data ?? []) as Volunteer[];

  return (
    <>
      <h1 className="text-2xl font-bold text-navy">Volunteers</h1>
      <Card>
        <CardHeader>
          <CardTitle>Invite a Volunteer</CardTitle>
          <CardDescription>They get an email to sign in. Existing accounts are given the role directly.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={inviteVolunteer} success="Invitation sent (or role granted to the existing account)." className="flex flex-col gap-4">
            <FieldGroup className="grid items-end gap-4 sm:grid-cols-[2fr_2fr_1fr_auto]">
              <Field>
                <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                <Input id="invite-email" name="email" type="email" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-name">Display name</FieldLabel>
                <Input id="invite-name" name="display_name" />
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-role">Role</FieldLabel>
                <NativeSelect id="invite-role" name="role" defaultValue="volunteer">
                  <NativeSelectOption value="volunteer">Volunteer</NativeSelectOption>
                  <NativeSelectOption value="coordinator">Coordinator</NativeSelectOption>
                </NativeSelect>
              </Field>
              <SubmitButton>Invite</SubmitButton>
            </FieldGroup>
          </ActionForm>
        </CardContent>
      </Card>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead className="pr-4">Role and access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {volunteers.map((v) => (
              <TableRow key={v.user_id}>
                <TableCell className="pl-4 font-medium">{v.display_name}</TableCell>
                <TableCell className="pr-4">
                  <ActionForm action={updateVolunteer} success="Saved." className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="user_id" value={v.user_id} />
                    <NativeSelect name="role" defaultValue={v.role} aria-label={`Role for ${v.display_name}`}>
                      <NativeSelectOption value="volunteer">Volunteer</NativeSelectOption>
                      <NativeSelectOption value="coordinator">Coordinator</NativeSelectOption>
                    </NativeSelect>
                    <CheckboxField id={`active-${v.user_id}`} name="active" label="Active" defaultChecked={v.active} />
                    <SubmitButton variant="outline">Save</SubmitButton>
                  </ActionForm>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
