import { requireCoordinator } from "@/lib/auth";

export default async function SettingsLayout({ children }: LayoutProps<"/v/settings">) {
  await requireCoordinator();
  return children;
}
