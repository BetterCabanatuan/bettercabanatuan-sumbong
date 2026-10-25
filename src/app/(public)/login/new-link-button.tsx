"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** For the expired-link alert: jumps to the email field so a new link is one tap away. */
export function NewLinkButton() {
  const t = useTranslations("login");
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-2"
      onClick={() => document.getElementById("email")?.focus()}
    >
      {t("newLink")}
    </Button>
  );
}
