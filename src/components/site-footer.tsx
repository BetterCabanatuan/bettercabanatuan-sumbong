import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand-mark";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="no-print mt-auto bg-navy text-navy-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:justify-between">
        <div className="flex max-w-md flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <BrandMark className="ring-1 ring-white/20 rounded-lg" />
            <span className="font-semibold">Sumbong · BetterCabanatuan</span>
          </div>
          <p className="text-sm text-white/80">{t("unofficial")}</p>
          <p className="text-sm text-white/80">{t("emergency")}</p>
        </div>
        <nav className="flex flex-col gap-2 text-sm" aria-label={t("links")}>
          <Link href="/about" className="text-white/90 hover:text-white hover:underline">
            {t("about")}
          </Link>
          <Link href="/privacy" className="text-white/90 hover:text-white hover:underline">
            {t("privacy")}
          </Link>
          <a href="https://bettercabanatuan.org" className="text-white/90 hover:text-white hover:underline">
            bettercabanatuan.org
          </a>
        </nav>
      </div>
      <div className="border-t border-white/15">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-white/70">{t("attribution")}</p>
      </div>
    </footer>
  );
}
