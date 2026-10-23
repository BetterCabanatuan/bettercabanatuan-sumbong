import { requirePermission } from "@/lib/auth";

export default async function ReportsLayout({ children }: LayoutProps<"/v/reports">) {
  await requirePermission("reports.view");
  return children;
}
