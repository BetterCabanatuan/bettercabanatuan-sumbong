import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title") };
}

interface Section {
  heading: string;
  items: string[];
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  const sections = t.raw("sections") as Section[];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      {sections.map((section, i) => (
        <section key={section.heading} className="flex flex-col gap-3">
          {i > 0 && <Separator />}
          <h2 className="text-lg font-semibold">{section.heading}</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 leading-relaxed">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      <Card>
        <CardHeader>
          <CardTitle>{t("contactHeading")}</CardTitle>
          <CardDescription>{SITE.dataProtectionOfficer}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <a href={`mailto:${SITE.privacyEmail}`} className="font-medium text-primary underline">
            {SITE.privacyEmail}
          </a>
          <p className="text-muted-foreground">{t("npc")}</p>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{t("updated")}</p>
    </main>
  );
}
