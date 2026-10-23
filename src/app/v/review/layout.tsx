import { requirePermission } from "@/lib/auth";

export default async function ReviewLayout({ children }: LayoutProps<"/v/review">) {
  await requirePermission("reports.review");
  return children;
}
