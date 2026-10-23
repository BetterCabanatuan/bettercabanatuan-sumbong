"use client";

import { CircleCheck, CircleDashed } from "lucide-react";
import { useState } from "react";
import type { VolunteerActionResult } from "@/app/v/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm, SubmitButton } from "@/components/volunteer/action-form";
import type { Category, ResponsibleOffice } from "@/lib/types";

type Action = (form: FormData) => Promise<VolunteerActionResult>;

const REJECT_PRESETS = [
  "Outside Cabanatuan City",
  "Not a public-space problem",
  "Photo does not show the problem",
  "Accuses or identifies a private person",
  "Abusive or spam",
  "Emergency: referred to CDRRMO/CELCOR hotline",
];

/**
 * The Review decision: one panel, one outcome at a time. Approve stays locked until every
 * photo is published or hidden; Reject needs a reason picked on purpose (there is no default).
 */
export function ReviewDecision({
  approve,
  reject,
  categories,
  offices,
  categoryId,
  suggestedOfficeId,
  photos,
}: {
  approve: Action;
  reject: Action;
  categories: Category[];
  offices: ResponsibleOffice[];
  categoryId: string;
  suggestedOfficeId: string | null;
  photos: { total: number; pending: number };
}) {
  const [preset, setPreset] = useState<string | null>(null);
  const cleared = photos.total - photos.pending;
  const photosDone = photos.pending === 0;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Decision</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="approve">
          <TabsList className="w-full">
            <TabsTrigger value="approve">Approve</TabsTrigger>
            <TabsTrigger value="reject">Reject</TabsTrigger>
          </TabsList>
          {/* keepMounted: switching back keeps what was typed. */}
          <TabsContent value="approve" keepMounted className="pt-2">
            <ActionForm action={approve} className="flex flex-col gap-4">
              <p className="text-muted-foreground">The Report goes on the public board and into the office’s next Digest.</p>
              <div
                className={
                  photosDone
                    ? "flex items-center gap-2 rounded-lg bg-status-resolved px-3 py-2 text-status-resolved-foreground"
                    : "flex items-center gap-2 rounded-lg bg-status-published px-3 py-2 text-status-published-foreground"
                }
              >
                {photosDone ? <CircleCheck className="size-4 shrink-0" /> : <CircleDashed className="size-4 shrink-0" />}
                <span className="flex-1 font-medium">
                  Photos: {cleared} of {photos.total} cleared
                </span>
                {!photosDone && (
                  <a href="#photos" className="underline underline-offset-3">
                    Review
                  </a>
                )}
              </div>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="category_id">Category</FieldLabel>
                  <NativeSelect id="category_id" name="category_id" defaultValue={categoryId} className="w-full">
                    {categories.map((c) => (
                      <NativeSelectOption key={c.id} value={c.id}>
                        {c.name_en}
                        {c.active ? "" : " (inactive)"}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="office_id">Responsible Office</FieldLabel>
                  <NativeSelect id="office_id" name="office_id" defaultValue={suggestedOfficeId ?? ""} required className="w-full">
                    <NativeSelectOption value="" disabled>
                      Choose an office
                    </NativeSelectOption>
                    {offices.map((o) => (
                      <NativeSelectOption key={o.id} value={o.id}>
                        {o.short_name}: {o.name_en}
                        {o.id === suggestedOfficeId ? " · suggested" : ""}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>Suggested by the Category. A national highway goes to DPWH.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="approve-note">Internal note (optional)</FieldLabel>
                  <Textarea id="approve-note" name="note" maxLength={500} />
                </Field>
              </FieldGroup>
              <SubmitButton disabled={!photosDone} className="h-10 w-full">
                Approve and publish
              </SubmitButton>
              {!photosDone && (
                <p className="-mt-2 text-center text-muted-foreground">Publish or hide every photo first.</p>
              )}
            </ActionForm>
          </TabsContent>

          <TabsContent value="reject" keepMounted className="pt-2">
            <ActionForm action={reject} className="flex flex-col gap-4">
              <input type="hidden" name="from" value="review" />
              <input type="hidden" name="preset" value={preset ?? ""} />
              <p className="text-muted-foreground">The Reporter sees the reason if they left contact details.</p>
              <FieldSet>
                <FieldLegend variant="label">Reason</FieldLegend>
                <RadioGroup value={preset ?? ""} onValueChange={(value) => setPreset(value as string)} className="gap-1.5">
                  {REJECT_PRESETS.map((reason, i) => (
                    <FieldLabel key={reason} htmlFor={`reject-${i}`}>
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle className="font-normal">{reason}</FieldTitle>
                        </FieldContent>
                        <RadioGroupItem value={reason} id={`reject-${i}`} />
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              </FieldSet>
              <Field>
                <FieldLabel htmlFor="reason">Details (optional)</FieldLabel>
                <Textarea id="reason" name="reason" maxLength={500} />
              </Field>
              <SubmitButton variant="destructive" disabled={!preset} className="h-10 w-full">
                Reject Report
              </SubmitButton>
            </ActionForm>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
