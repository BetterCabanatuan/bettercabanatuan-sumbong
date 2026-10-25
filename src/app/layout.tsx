import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Providers } from "@/components/providers";
import { RouteProgress } from "@/components/route-progress";
import { cn } from "@/lib/utils";
import { plexMono, plexSans } from "./fonts";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: t("title"), template: `%s · ${t("shortTitle")}` },
    description: t("description"),
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#002e6e",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale === "fil" ? "fil" : "en"} className={cn("h-full antialiased", plexSans.variable, plexMono.variable)}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <Providers>
            {/* Reads the URL, which needs a boundary of its own outside the render path. */}
            <Suspense fallback={null}>
              <RouteProgress />
            </Suspense>
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
