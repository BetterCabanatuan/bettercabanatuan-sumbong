import { redirect } from "next/navigation";
import { SETTINGS } from "@/components/volunteer/nav";
import { requireVolunteer } from "@/lib/auth";

export default async function SettingsIndex() {
  const volunteer = await requireVolunteer();
  const first = SETTINGS.find((item) => volunteer.permissions.includes(item.permission));
  redirect(first?.href ?? "/v?forbidden=1");
}
