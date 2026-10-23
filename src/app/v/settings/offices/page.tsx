import { Plus } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { setOfficeActive } from "@/app/v/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionForm, SubmitButton } from "@/components/volunteer/action-form";
import { DataView } from "@/components/volunteer/data-view";
import { ListHeader } from "@/components/volunteer/list-header";
import { can, requirePermission } from "@/lib/auth";
import { getOffices } from "@/lib/data";
import { resolveView } from "@/lib/data-view";

export default async function OfficesPage({ searchParams }: PageProps<"/v/settings/offices">) {
  const me = await requirePermission("offices.view");
  const view = resolveView("offices", await searchParams, await cookies());
  const offices = await getOffices({ includeInactive: true });

  return (
    <>
      <ListHeader
        title="Responsible Offices"
        description="Offices never log in. Volunteers carry Reports to them in Digests through each office’s official channel."
        screen="offices"
        view={view}
      >
        {can(me, "offices.add") && (
          <Button nativeButton={false} render={<Link href="/v/settings/offices/new" />}>
            <Plus data-icon="inline-start" />
            New office
          </Button>
        )}
      </ListHeader>
      <DataView
        view={view}
        items={offices}
        itemKey={(office) => office.id}
        titleLabel="Office"
        title={(office) => office.name_en}
        subtitle={(office) => office.short_name}
        href={(office) => `/v/settings/offices/${office.id}`}
        badges={(office) => !office.active && <Badge variant="outline">Archived</Badge>}
        fields={[
          {
            key: "scope",
            label: "Scope",
            value: (office) => (office.scope === "per_barangay" ? "Per barangay" : "Citywide"),
          },
          { key: "channel", label: "Channel", value: (office) => office.channel, hideInList: true },
          { key: "contact", label: "Contact", value: (office) => [office.email, office.phone].filter(Boolean).join(" · ") || "—" },
        ]}
        actions={
          can(me, "offices.archive")
            ? (office) => (
                <ActionForm action={setOfficeActive.bind(null, office.id, !office.active)}>
                  <SubmitButton variant="ghost">{office.active ? "Archive" : "Restore"}</SubmitButton>
                </ActionForm>
              )
            : undefined
        }
        empty="No Responsible Offices yet."
      />
    </>
  );
}
