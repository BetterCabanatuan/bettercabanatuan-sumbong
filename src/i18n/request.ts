import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "./config";

export default getRequestConfig(async () => {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(stored) ? stored : DEFAULT_LOCALE;

  return {
    locale,
    timeZone: "Asia/Manila",
    // One "now" per request, shared with Client Components, so relative times ("6 days ago")
    // render the same on the server and in the browser.
    now: new Date(),
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
