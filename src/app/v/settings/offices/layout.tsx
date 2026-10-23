import { requirePermission } from "@/lib/auth";

export default async function OfficesLayout({ children }: LayoutProps<"/v/settings/offices">) {
  await requirePermission("offices.view");
  return children;
}
