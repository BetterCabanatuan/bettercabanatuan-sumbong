import { requirePermission } from "@/lib/auth";

export default async function DigestsLayout({ children }: LayoutProps<"/v/digests">) {
  await requirePermission("digests.view");
  return children;
}
