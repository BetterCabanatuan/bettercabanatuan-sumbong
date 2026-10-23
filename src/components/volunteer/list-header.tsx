import { Download } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ViewSwitcher } from "@/components/volunteer/view-switcher";
import type { DataViewMode } from "@/lib/data-view";

/** The top of a console list: title, description, its buttons, and the table/list/grid switcher. */
export function ListHeader({
  title,
  description,
  screen,
  view,
  exportHref,
  children,
}: {
  title: string;
  description?: ReactNode;
  screen: string;
  view: DataViewMode;
  /** Shown only to roles with this area's Export permission. */
  exportHref?: string | null;
  /** Primary buttons, such as "New role". */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex max-w-3xl flex-col gap-1">
        <h1 className="text-2xl font-bold text-navy">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {exportHref && (
          <Button variant="outline" nativeButton={false} render={<a href={exportHref} download />}>
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
        )}
        {children}
        <ViewSwitcher screen={screen} view={view} />
      </div>
    </div>
  );
}
