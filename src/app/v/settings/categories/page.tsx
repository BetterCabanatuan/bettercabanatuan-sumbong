import { Plus } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { setCategoryActive } from "@/app/v/actions";
import { CategoryIcon } from "@/components/category-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionForm, SubmitButton } from "@/components/volunteer/action-form";
import { DataView } from "@/components/volunteer/data-view";
import { ListHeader } from "@/components/volunteer/list-header";
import { can, requirePermission } from "@/lib/auth";
import { byId, getCategories, getOffices } from "@/lib/data";
import { resolveView } from "@/lib/data-view";

export default async function CategoriesPage({ searchParams }: PageProps<"/v/settings/categories">) {
  const me = await requirePermission("categories.view");
  const view = resolveView("categories", await searchParams, await cookies());
  const [categories, offices] = await Promise.all([getCategories({ includeInactive: true }), getOffices({ includeInactive: true })]);
  const officesById = byId(offices);

  return (
    <>
      <ListHeader
        title="Categories"
        description="What residents can report, and which office each goes to by default. Archived Categories are hidden from residents; their Reports keep them."
        screen="categories"
        view={view}
      >
        {can(me, "categories.add") && (
          <Button nativeButton={false} render={<Link href="/v/settings/categories/new" />}>
            <Plus data-icon="inline-start" />
            New Category
          </Button>
        )}
      </ListHeader>
      <DataView
        view={view}
        items={categories}
        itemKey={(c) => c.id}
        titleLabel="Category"
        title={(c) => (
          <span className="inline-flex items-center gap-2">
            <CategoryIcon icon={c.icon} className="size-4" />
            {c.name_en}
          </span>
        )}
        subtitle={(c) => c.name_fil}
        href={(c) => `/v/settings/categories/${c.id}`}
        badges={(c) => !c.active && <Badge variant="outline">Archived</Badge>}
        fields={[
          {
            key: "office",
            label: "Default office",
            value: (c) => (c.default_office_id ? officesById.get(c.default_office_id)?.short_name : "None"),
          },
          { key: "questions", label: "Questions", numeric: true, value: (c) => c.questions.length },
        ]}
        actions={
          can(me, "categories.archive")
            ? (c) => (
                <ActionForm action={setCategoryActive.bind(null, c.id, !c.active)}>
                  <SubmitButton variant="ghost">{c.active ? "Archive" : "Restore"}</SubmitButton>
                </ActionForm>
              )
            : undefined
        }
        empty="No Categories yet."
      />
    </>
  );
}
