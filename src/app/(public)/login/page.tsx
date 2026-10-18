import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title"), robots: { index: false } };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const t = await getTranslations("login");
  const next = typeof params.next === "string" ? params.next : "/me";

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-10">
      {params.denied && (
        <Alert className="bg-card">
          <AlertDescription>{t("denied")}</AlertDescription>
        </Alert>
      )}
      {params.error && (
        <Alert variant="destructive" className="bg-card">
          <AlertDescription>{t("linkError")}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold text-navy">{t("title")}</CardTitle>
          <CardDescription>{t("lead")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next} />
        </CardContent>
      </Card>
    </main>
  );
}
