"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { consoleCrumbs } from "@/lib/breadcrumbs";

/** Where you are in the console: "Settings / Roles / Edit". The last crumb is the page itself. */
export function ConsoleBreadcrumb() {
  const crumbs = consoleCrumbs(usePathname());
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, i) => (
          <Fragment key={crumb.href}>
            {i > 0 && <BreadcrumbSeparator className="hidden sm:block" />}
            <BreadcrumbItem className={i === crumbs.length - 1 ? "min-w-0" : "hidden sm:inline-flex"}>
              {i === crumbs.length - 1 ? (
                <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
              ) : (
                // Phones show only the page itself, so the topbar never wraps.
                <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
