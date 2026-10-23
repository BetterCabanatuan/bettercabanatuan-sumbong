import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { saveOffice, setOfficeActive } from "@/app/v/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm, SubmitButton } from "@/components/volunteer/action-form";
import { can, requirePermission } from "@/lib/auth";
import { getOffices } from "@/lib/data";

export default async function OfficePage({ params, searchParams }: PageProps<"/v/settings/offices/[id]">) {
  const { id } = await params;
  const isNew = id === "new";
  const me = await requirePermission(isNew ? "offices.add" : "offices.view");
  const query = await searchParams;
  const office = isNew ? undefined : (await getOffices({ includeInactive: true })).find((o) => o.id === id);
  if (!isNew && !office) notFound();
  const editable = isNew || can(me, "offices.edit");
  const key = office?.id ?? "new";

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="self-start" nativeButton={false} render={<Link href="/v/settings/offices" />}>
          <ArrowLeft data-icon="inline-start" />
          Responsible Offices
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-navy">
            {office ? office.name_en : "New office"}
            {office && !office.active && <Badge variant="outline">Archived</Badge>}
          </h1>
          {office && can(me, "offices.archive") && (
            <ActionForm action={setOfficeActive.bind(null, office.id, !office.active)}>
              <SubmitButton variant="outline">{office.active ? "Archive" : "Restore"}</SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>
      {query.saved && (
        <Alert>
          <AlertDescription>Saved.</AlertDescription>
        </Alert>
      )}

      <Card>
        <ActionForm action={saveOffice} className="contents">
          {office && <input type="hidden" name="id" value={office.id} />}
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              {editable ? (
                <>
                  In a per-barangay office’s addressee, <code>{"{barangay}"}</code> is replaced with the barangay name.
                </>
              ) : (
                "You can view this office but not change it."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset disabled={!editable} className="contents">
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`short-${key}`}>Short name</FieldLabel>
                  <Input id={`short-${key}`} name="short_name" defaultValue={office?.short_name} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`scope-${key}`}>Scope</FieldLabel>
                  <NativeSelect id={`scope-${key}`} name="scope" defaultValue={office?.scope ?? "citywide"}>
                    <NativeSelectOption value="citywide">Citywide (one Digest)</NativeSelectOption>
                    <NativeSelectOption value="per_barangay">Per barangay (one Digest per barangay hall)</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`name_en-${key}`}>Name (English)</FieldLabel>
                  <Input id={`name_en-${key}`} name="name_en" defaultValue={office?.name_en} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`name_fil-${key}`}>Name (Filipino)</FieldLabel>
                  <Input id={`name_fil-${key}`} name="name_fil" defaultValue={office?.name_fil} required />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor={`channel-${key}`}>Official channel</FieldLabel>
                  <Textarea id={`channel-${key}`} name="channel" defaultValue={office?.channel} required />
                  <FieldDescription>How a Digest reaches this office, per its Citizen’s Charter.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`addressee-${key}`}>Letter addressee</FieldLabel>
                  <Textarea id={`addressee-${key}`} name="letter_addressee" defaultValue={office?.letter_addressee ?? ""} rows={3} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`attention-${key}`}>Attention line</FieldLabel>
                  <Input id={`attention-${key}`} name="letter_attention" defaultValue={office?.letter_attention ?? ""} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`email-${key}`}>Email</FieldLabel>
                  <Input id={`email-${key}`} name="email" type="email" defaultValue={office?.email ?? ""} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`phone-${key}`}>Phone</FieldLabel>
                  <Input id={`phone-${key}`} name="phone" defaultValue={office?.phone ?? ""} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`address-${key}`}>Address</FieldLabel>
                  <Input id={`address-${key}`} name="address" defaultValue={office?.address ?? ""} />
                </Field>
              </FieldGroup>
            </fieldset>
          </CardContent>
          {editable && (
            <CardFooter className="gap-2">
              <SubmitButton>{isNew ? "Create office" : "Save office"}</SubmitButton>
              <Button variant="ghost" nativeButton={false} render={<Link href="/v/settings/offices" />}>
                Cancel
              </Button>
            </CardFooter>
          )}
        </ActionForm>
      </Card>
    </>
  );
}
