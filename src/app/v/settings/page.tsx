import { redirect } from "next/navigation";

export default function SettingsIndex() {
  redirect("/v/settings/categories");
}
