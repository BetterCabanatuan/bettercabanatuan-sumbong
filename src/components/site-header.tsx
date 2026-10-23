import { Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandMark, FlagStripe } from "@/components/brand-mark";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { getVolunteer } from "@/lib/auth";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const volunteer = await getVolunteer();
  // Signed-out residents also go to /me: it lists the Reports saved on this device and offers sign-in.
  const account = volunteer ? { href: "/v", label: t("volunteer") } : { href: "/me", label: t("myReports") };

  return (
    <header className="no-print sticky top-0 z-40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <FlagStripe />
      <div className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 text-navy">
            <BrandMark />
            <span className="flex flex-col leading-tight">
              <span className="font-semibold">Sumbong</span>
              <span className="text-xs text-muted-foreground">BetterCabanatuan</span>
            </span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            <Button variant="ghost" nativeButton={false} render={<Link href="/" />}>
              {t("board")}
            </Button>
            <Button variant="ghost" nativeButton={false} render={<Link href="/about" />}>
              {t("about")}
            </Button>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            <Button variant="ghost" nativeButton={false} render={<Link href={account.href} />} className="hidden sm:inline-flex">
              {account.label}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              nativeButton={false}
              render={<Link href={account.href} aria-label={account.label} />}
              className="sm:hidden"
            >
              <UserRound />
            </Button>
            <Button nativeButton={false} render={<Link href="/report" />} className="hidden md:inline-flex">
              <Plus data-icon="inline-start" />
              {t("report")}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
