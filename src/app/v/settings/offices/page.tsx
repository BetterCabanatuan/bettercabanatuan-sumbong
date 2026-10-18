import { saveOffice } from "@/app/v/actions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm, SubmitButton } from "@/components/volunteer/action-form";
import { CheckboxField } from "@/components/volunteer/checkbox-field";
import { getOffices } from "@/lib/data";
import type { ResponsibleOffice } from "@/lib/types";

export default async function OfficesPage({ searchParams }: PageProps<"/v/settings/offices">) {
  const query = await searchParams;
  const offices = await getOffices({ includeInactive: true });

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-navy">Responsible Offices</h1>
        <p className="max-w-3xl text-muted-foreground">
          Offices never log in. Volunteers carry Reports to them in Digests through the channel below. In a per-barangay
          office’s addressee, <code>{"{barangay}"}</code> is replaced with the barangay name.
        </p>
      </div>
      {query.saved && (
        <Alert>
          <AlertDescription>Saved.</AlertDescription>
        </Alert>
      )}
      <Card className="py-0">
        <CardContent className="px-0">
          <Accordion>
            {offices.map((office) => (
              <AccordionItem key={office.id} value={office.id}>
                <AccordionTrigger className="px-4">
                  <span className="flex items-center gap-2">
                    {office.name_en} <span className="text-muted-foreground">({office.short_name})</span>
                    {!office.active && <Badge variant="outline">Inactive</Badge>}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4">
                  <OfficeForm office={office} />
                </AccordionContent>
              </AccordionItem>
            ))}
            <AccordionItem value="new">
              <AccordionTrigger className="px-4">Add an office</AccordionTrigger>
              <AccordionContent className="px-4">
                <OfficeForm />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </>
  );
}

function OfficeForm({ office }: { office?: ResponsibleOffice }) {
  const key = office?.id ?? "new";
  return (
    <ActionForm action={saveOffice} className="flex flex-col gap-4 pb-2">
      {office && <input type="hidden" name="id" value={office.id} />}
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
        <CheckboxField id={`active-${key}`} name="active" label="Active" defaultChecked={office?.active ?? true} />
      </FieldGroup>
      <SubmitButton className="self-start">Save office</SubmitButton>
    </ActionForm>
  );
}
