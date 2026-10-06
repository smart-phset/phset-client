import { cookies } from "next/headers";
import { LANG_COOKIE, translate, type Lang } from "./i18n-core";

export async function getLang(): Promise<Lang> {
  return (await cookies()).get(LANG_COOKIE)?.value === "km" ? "km" : "en";
}

/** t() for server components. */
export async function getT() {
  const lang = await getLang();
  return (en: string, vars?: Record<string, string | number>) => translate(lang, en, vars);
}
