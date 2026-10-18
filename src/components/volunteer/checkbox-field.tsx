import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";

/** A labelled checkbox that submits "on" with its form, like a native checkbox. */
export function CheckboxField({ id, name, label, defaultChecked }: { id: string; name: string; label: string; defaultChecked?: boolean }) {
  return (
    <Field orientation="horizontal">
      <Checkbox id={id} name={name} defaultChecked={defaultChecked} />
      <FieldLabel htmlFor={id} className="font-normal">
        {label}
      </FieldLabel>
    </Field>
  );
}
