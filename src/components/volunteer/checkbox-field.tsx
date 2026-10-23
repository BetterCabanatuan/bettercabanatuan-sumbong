import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";

/** A labelled checkbox that submits `value` ("on" by default) with its form, like a native checkbox. */
export function CheckboxField({
  id,
  name,
  label,
  defaultChecked,
  value,
}: {
  id: string;
  name: string;
  label: string;
  defaultChecked?: boolean;
  value?: string;
}) {
  return (
    <Field orientation="horizontal">
      <Checkbox id={id} name={name} value={value} defaultChecked={defaultChecked} />
      <FieldLabel htmlFor={id} className="font-normal">
        {label}
      </FieldLabel>
    </Field>
  );
}
