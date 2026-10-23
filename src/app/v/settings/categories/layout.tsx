import { requirePermission } from "@/lib/auth";

export default async function CategoriesLayout({ children }: LayoutProps<"/v/settings/categories">) {
  await requirePermission("categories.view");
  return children;
}
