"use client";

import { useState } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Past this the counter turns to a warning; nothing stops the Volunteer from going over. */
const SOFT_LIMIT = 300;

/** An Office's official channel: a textarea with a hint and a character count. */
export function ChannelField({ id, defaultValue }: { id: string; defaultValue?: string }) {
  const [length, setLength] = useState(defaultValue?.length ?? 0);
  const over = length > SOFT_LIMIT;
  return (
    <Field className="sm:col-span-2">
      <FieldLabel htmlFor={id}>Official channel</FieldLabel>
      <Textarea
        id={id}
        name="channel"
        defaultValue={defaultValue}
        required
        aria-describedby={`${id}-hint ${id}-count`}
        onChange={(event) => setLength(event.target.value.length)}
      />
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <FieldDescription id={`${id}-hint`} className="min-w-0 flex-1">
          How a Digest reaches this office, as a Volunteer would say it: letter to whom, text line, email. Volunteers see this
          on the Digest page; the letter itself is addressed with the fields below.
        </FieldDescription>
        <p id={`${id}-count`} className={cn("text-sm tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
          {length} / {SOFT_LIMIT}
          {over && " · long for one line"}
        </p>
      </div>
    </Field>
  );
}
