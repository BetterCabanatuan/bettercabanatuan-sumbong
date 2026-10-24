import { notFound } from "next/navigation";
import { saveCategory, saveQuestion, setCategoryActive } from "@/app/v/actions";
import { CATEGORY_ICONS } from "@/components/category-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ActionFieldError, ActionForm, SubmitButton } from "@/components/volunteer/action-form";
import { CheckboxField } from "@/components/volunteer/checkbox-field";
import { can, requirePermission } from "@/lib/auth";
import { getCategories, getOffices } from "@/lib/data";
import type { CategoryQuestion } from "@/lib/types";

export default async function CategoryPage({ params, searchParams }: PageProps<"/v/settings/categories/[id]">) {
  const { id } = await params;
  const isNew = id === "new";
  const me = await requirePermission(isNew ? "categories.add" : "categories.view");
  const query = await searchParams;
  const [categories, offices] = await Promise.all([getCategories({ includeInactive: true }), getOffices()]);
  const category = categories.find((c) => c.id === id);
  if (!isNew && !category) notFound();
  const editable = isNew || can(me, "categories.edit");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-navy">
          {isNew ? "New Category" : category!.name_en}
          {category && !category.active && <Badge variant="outline">Archived</Badge>}
        </h1>
        {category && can(me, "categories.archive") && (
          <ActionForm action={setCategoryActive.bind(null, category.id, !category.active)}>
            <SubmitButton variant="outline">{category.active ? "Archive" : "Restore"}</SubmitButton>
          </ActionForm>
        )}
      </div>
      {query.saved && (
        <Alert>
          <AlertDescription>Saved.</AlertDescription>
        </Alert>
      )}

      <Card>
        <ActionForm schema="category" action={saveCategory} className="contents">
          {category && <input type="hidden" name="id" value={category.id} />}
          <CardHeader>
            <CardTitle>Details</CardTitle>
            {!editable && <CardDescription>You can view this Category but not change it.</CardDescription>}
          </CardHeader>
          <CardContent>
            <fieldset disabled={!editable} className="contents">
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="name_en">Name (English)</FieldLabel>
                  <Input id="name_en" name="name_en" defaultValue={category?.name_en} required />
                  <ActionFieldError name="name_en" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="name_fil">Name (Filipino)</FieldLabel>
                  <Input id="name_fil" name="name_fil" defaultValue={category?.name_fil} required />
                  <ActionFieldError name="name_fil" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="description_en">Description (English)</FieldLabel>
                  <Textarea id="description_en" name="description_en" defaultValue={category?.description_en ?? ""} />
                  <ActionFieldError name="description_en" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="description_fil">Description (Filipino)</FieldLabel>
                  <Textarea id="description_fil" name="description_fil" defaultValue={category?.description_fil ?? ""} />
                  <ActionFieldError name="description_fil" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="urgent_notice_en">Urgent notice (English)</FieldLabel>
                  <Textarea id="urgent_notice_en" name="urgent_notice_en" defaultValue={category?.urgent_notice_en ?? ""} />
                  <FieldDescription>Shown before the form, for hazards that must not wait for a Digest.</FieldDescription>
                  <ActionFieldError name="urgent_notice_en" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="urgent_notice_fil">Urgent notice (Filipino)</FieldLabel>
                  <Textarea id="urgent_notice_fil" name="urgent_notice_fil" defaultValue={category?.urgent_notice_fil ?? ""} />
                  <ActionFieldError name="urgent_notice_fil" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="slug">Slug</FieldLabel>
                  <Input id="slug" name="slug" defaultValue={category?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
                  <FieldDescription>Lowercase letters, numbers and dashes. Used in board links.</FieldDescription>
                  <ActionFieldError name="slug" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="icon">Icon</FieldLabel>
                  <NativeSelect id="icon" name="icon" defaultValue={category?.icon ?? "circle-alert"}>
                    {Object.keys(CATEGORY_ICONS).map((icon) => (
                      <NativeSelectOption key={icon} value={icon}>
                        {icon}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="default_office_id">Default Responsible Office</FieldLabel>
                  <NativeSelect id="default_office_id" name="default_office_id" defaultValue={category?.default_office_id ?? ""}>
                    <NativeSelectOption value="">None</NativeSelectOption>
                    {offices.map((o) => (
                      <NativeSelectOption key={o.id} value={o.id}>
                        {o.name_en} ({o.short_name})
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>Becomes the Suggested Office in Review.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="sort_order">Sort order</FieldLabel>
                  <Input id="sort_order" name="sort_order" type="number" defaultValue={category?.sort_order ?? 100} />
                  <ActionFieldError name="sort_order" />
                </Field>
              </FieldGroup>
            </fieldset>
          </CardContent>
          {editable && (
            <CardFooter>
              <SubmitButton>{isNew ? "Create Category" : "Save Category"}</SubmitButton>
            </CardFooter>
          )}
        </ActionForm>
      </Card>

      {category && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Category Questions</h2>
            <p className="text-muted-foreground">Extra questions residents answer for this Category.</p>
          </div>
          {category.questions.map((q) => (
            <QuestionForm key={q.id} categoryId={category.id} question={q} editable={editable} />
          ))}
          {editable && <QuestionForm categoryId={category.id} editable />}
        </section>
      )}
    </>
  );
}

function QuestionForm({
  categoryId,
  question,
  editable,
}: {
  categoryId: string;
  question?: CategoryQuestion;
  editable: boolean;
}) {
  const key = question?.id ?? "new";
  return (
    <Card size="sm">
      <ActionForm schema="question" action={saveQuestion} success="Saved." className="contents">
        <input type="hidden" name="category_id" value={categoryId} />
        {question && <input type="hidden" name="id" value={question.id} />}
        <CardHeader>
          <CardTitle>{question ? question.prompt_en : "Add a question"}</CardTitle>
          {question && <CardDescription>{question.prompt_fil}</CardDescription>}
        </CardHeader>
        <CardContent>
          <fieldset disabled={!editable} className="contents">
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`prompt_en-${key}`}>Question (English)</FieldLabel>
                <Input id={`prompt_en-${key}`} name="prompt_en" defaultValue={question?.prompt_en} required />
                <ActionFieldError name="prompt_en" />
              </Field>
              <Field>
                <FieldLabel htmlFor={`prompt_fil-${key}`}>Question (Filipino)</FieldLabel>
                <Input id={`prompt_fil-${key}`} name="prompt_fil" defaultValue={question?.prompt_fil} required />
                <ActionFieldError name="prompt_fil" />
              </Field>
              <Field>
                <FieldLabel htmlFor={`kind-${key}`}>Answer type</FieldLabel>
                <NativeSelect id={`kind-${key}`} name="kind" defaultValue={question?.kind ?? "choice"}>
                  <NativeSelectOption value="choice">Choice</NativeSelectOption>
                  <NativeSelectOption value="yes_no">Yes / No</NativeSelectOption>
                  <NativeSelectOption value="text">Short text</NativeSelectOption>
                </NativeSelect>
                <ActionFieldError name="kind" />
              </Field>
              <Field>
                <FieldLabel htmlFor={`sort-${key}`}>Sort order</FieldLabel>
                <Input id={`sort-${key}`} name="sort_order" type="number" defaultValue={question?.sort_order ?? 100} />
                <ActionFieldError name="sort_order" />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor={`choices-${key}`}>Choices</FieldLabel>
                <Textarea
                  id={`choices-${key}`}
                  name="choices"
                  rows={4}
                  className="font-mono"
                  defaultValue={question?.choices.map((c) => `${c.value} | ${c.label_en} | ${c.label_fil}`).join("\n")}
                />
                <FieldDescription>
                  Choice questions only. One per line: value | English | Filipino. Don’t change values that already have answers.
                </FieldDescription>
                <ActionFieldError name="choices" />
              </Field>
              <CheckboxField id={`required-${key}`} name="required" label="Required" defaultChecked={question?.required ?? false} />
              <CheckboxField id={`active-${key}`} name="active" label="Active" defaultChecked={question?.active ?? true} />
            </FieldGroup>
          </fieldset>
        </CardContent>
        {editable && (
          <CardFooter>
            <SubmitButton variant="outline">{question ? "Save question" : "Add question"}</SubmitButton>
          </CardFooter>
        )}
      </ActionForm>
    </Card>
  );
}
