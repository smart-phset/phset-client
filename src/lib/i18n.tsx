"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState } from "react";
import { LANG_COOKIE, translate, translateData, type Lang } from "./i18n-core";

export type { Lang };

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const router = useRouter();
  const setLang = useCallback((l: Lang) => {
    document.cookie = `${LANG_COOKIE}=${l}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = l;
    setLangState(l);
    router.refresh(); // server-rendered pages pick up the new language
  }, [router]);
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}

/** td(sentenceFromData) in client components: alert details, activity reasons. */
export function useTD() {
  const { lang } = useContext(Ctx);
  return useCallback((s: string) => translateData(lang, s), [lang]);
}

/** t("Text", { n: 3 }) in client components. */
export function useT() {
  const { lang } = useContext(Ctx);
  return useCallback((en: string, vars?: Record<string, string | number>) => translate(lang, en, vars), [lang]);
}
