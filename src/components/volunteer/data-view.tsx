import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DataViewMode } from "@/lib/data-view";
import { cn } from "@/lib/utils";

export interface DataField<T> {
  key: string;
  label: string;
  value: (item: T) => ReactNode;
  /** Right-aligned numbers in the table. */
  numeric?: boolean;
  /** Left out of the list layout, which shows only the most useful facts on one line. */
  hideInList?: boolean;
}

interface DataViewProps<T> {
  view: DataViewMode;
  items: T[];
  itemKey: (item: T) => string;
  /** Column header for the item's name in the table. */
  titleLabel: string;
  title: (item: T) => ReactNode;
  subtitle?: (item: T) => ReactNode;
  href?: (item: T) => string | null;
  /** Small things beside the title: status badges, "You". */
  badges?: (item: T) => ReactNode;
  fields: DataField<T>[];
  /** Buttons for one item, shown in every layout. */
  actions?: (item: T) => ReactNode;
  actionsLabel?: string;
  empty: ReactNode;
}

/** One console list, rendered as a table, a list or a grid of cards from the same fields. */
export function DataView<T>(props: DataViewProps<T>) {
  const { view, items, empty } = props;
  if (items.length === 0) {
    return (
      <Card className="py-0">
        <p className="p-6 text-center text-muted-foreground">{empty}</p>
      </Card>
    );
  }
  if (view === "list") return <ListLayout {...props} />;
  if (view === "grid") return <GridLayout {...props} />;
  return <TableLayout {...props} />;
}

function Title<T>({ item, title, href }: Pick<DataViewProps<T>, "title" | "href"> & { item: T }) {
  const target = href?.(item);
  return target ? (
    <Link href={target} className="font-medium text-primary underline-offset-4 hover:underline">
      {title(item)}
    </Link>
  ) : (
    <span className="font-medium">{title(item)}</span>
  );
}

function TableLayout<T>({ items, itemKey, titleLabel, title, subtitle, href, badges, fields, actions, actionsLabel }: DataViewProps<T>) {
  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">{titleLabel}</TableHead>
            {fields.map((field) => (
              <TableHead key={field.key} className={cn(field.numeric && "text-right")}>
                {field.label}
              </TableHead>
            ))}
            {actions && <TableHead className="pr-4 text-right">{actionsLabel ?? <span className="sr-only">Actions</span>}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={itemKey(item)}>
              <TableCell className="pl-4">
                <div className="flex flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <Title item={item} title={title} href={href} />
                    {badges?.(item)}
                  </span>
                  {subtitle && <span className="text-xs text-muted-foreground">{subtitle(item)}</span>}
                </div>
              </TableCell>
              {fields.map((field) => (
                <TableCell key={field.key} className={cn(field.numeric && "text-right tabular-nums")}>
                  {field.value(item)}
                </TableCell>
              ))}
              {actions && (
                <TableCell className="pr-4">
                  <div className="flex flex-wrap items-center justify-end gap-2">{actions(item)}</div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function ListLayout<T>({ items, itemKey, title, subtitle, href, badges, fields, actions }: DataViewProps<T>) {
  const shown = fields.filter((field) => !field.hideInList);
  return (
    <Card className="gap-0 py-0">
      <ul className="divide-y">
        {items.map((item) => (
          <li key={itemKey(item)} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <Title item={item} title={title} href={href} />
                {badges?.(item)}
              </span>
              {subtitle && <span className="text-sm text-muted-foreground">{subtitle(item)}</span>}
              {shown.length > 0 && (
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {shown.map((field) => (
                    <span key={field.key}>
                      {field.label}: <span className="text-foreground">{field.value(item)}</span>
                    </span>
                  ))}
                </p>
              )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions(item)}</div>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function GridLayout<T>({ items, itemKey, title, subtitle, href, badges, fields, actions }: DataViewProps<T>) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <li key={itemKey(item)}>
          <Card className="h-full gap-3 px-4 py-4">
            <div className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <Title item={item} title={title} href={href} />
                {badges?.(item)}
              </span>
              {subtitle && <span className="text-sm text-muted-foreground">{subtitle(item)}</span>}
            </div>
            {fields.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {fields.map((field) => (
                  <div key={field.key} className="contents">
                    <dt className="text-muted-foreground">{field.label}</dt>
                    <dd className={cn("min-w-0 break-words", field.numeric && "tabular-nums")}>{field.value(item)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actions && <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">{actions(item)}</div>}
          </Card>
        </li>
      ))}
    </ul>
  );
}
