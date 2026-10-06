import { redirect } from "next/navigation";
import { LangToggle } from "@/components/LangChoice";
import { getT } from "@/lib/i18n-server";
import { accountsEnabled, allowGuest, safeNext } from "@/lib/auth";
import { currentUser } from "@/lib/session";

const ERRORS: Record<string, string> = {
  wrong: "Wrong username or password.",
  noaccounts: "Team accounts are not set up yet. Please continue without an account for now.",
  noguest: "Guest access is turned off. Please sign in with your team account.",
};

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  if (await currentUser()) redirect(next);
  const t = await getT();
  const accounts = accountsEnabled();
  const guest = allowGuest();

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 bg-surface">
      <div className="relative lg:col-span-6 min-h-[260px] lg:min-h-screen flex flex-col justify-between overflow-hidden bg-surface-dim">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/photos/signin-hero.jpg')" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-on-background/90 via-on-background/35 to-on-background/60" />
        <div className="relative z-10 p-space-lg lg:p-space-xl flex items-center justify-between">
          <div className="flex items-center gap-space-sm bg-surface-container-lowest/90 backdrop-blur-md px-3.5 py-2 rounded-xl">
            <img alt="" className="h-8 w-8 object-contain" src="/brand/logo-mark.svg" />
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm tracking-tight text-[#19325A] leading-none">SmartPhset</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mt-0.5">{t("Mould early-warning")}</span>
            </div>
          </div>
        </div>
        <div className="relative z-10 p-space-lg lg:p-space-xl pb-10 flex flex-col max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary-container/20 text-secondary-fixed w-fit mb-4">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-secondary-fixed-dim">verified</span>
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">{t("Prototype · National Challenge 2026")}</span>
          </div>
          <h1 className="font-headline-hero-mobile text-headline-hero-mobile lg:font-headline-hero lg:text-headline-hero text-on-primary leading-tight tracking-tight drop-shadow-sm mb-3">
            {t("See mould early.")}<br />{t("Keep the harvest.")}
          </h1>
          <p className="font-body-lg text-body-lg text-surface-container-high/90 max-w-md leading-relaxed font-normal">
            {t("Climate control and AI mould checks for oyster-mushroom grow rooms in Cambodia.")}
          </p>
        </div>
      </div>

      <div className="lg:col-span-6 flex flex-col justify-between p-space-md sm:p-space-lg lg:p-space-xl bg-surface relative">
        <div className="flex justify-end w-full max-w-md mx-auto"><LangToggle /></div>
        <div className="w-full max-w-md mx-auto my-auto py-6">
          <div className="bg-surface-container-lowest rounded-xl p-space-lg sm:p-space-xl shadow-sm">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0">
                <img alt="" className="h-9 w-9 object-contain" src="/brand/logo-mark.svg" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">{t("Welcome")}</span>
                <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight mt-0.5">{t("Sign in to SmartPhset")}</h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">{t("See your grow rooms, check bags with the AI, and get alerts.")}</p>
              </div>
            </div>

            {error && ERRORS[error] && (
              <div role="alert" className="mb-4 flex items-start gap-2 bg-error-container text-on-error-container rounded-lg px-3 py-2 font-body-md text-body-md">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px] mt-0.5">error</span>
                {t(ERRORS[error])}
              </div>
            )}

            {guest && !accounts && (
              <div className="mb-6">
                <form method="post" action="/api/auth/signin">
                  <input type="hidden" name="mode" value="guest" />
                  <input type="hidden" name="next" value={next} />
                  <button type="submit" className="w-full h-12 bg-primary-container text-on-primary hover:bg-primary font-headline-sm text-headline-sm rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all">
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_forward</span>
                    <span>{t("Continue without an account")}</span>
                  </button>
                </form>
                <p className="mt-3 font-label-sm text-label-sm text-on-surface-variant text-center">{t("Try the full demo now. You can sign in later.")}</p>
                <div className="flex items-center gap-3 mt-6">
                  <span className="h-px flex-1 bg-outline-variant" />
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t("Team sign-in (coming soon)")}</span>
                  <span className="h-px flex-1 bg-outline-variant" />
                </div>
              </div>
            )}
            <form className="flex flex-col gap-5" method="post" action="/api/auth/signin">
              <input type="hidden" name="next" value={next} />
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface font-semibold" htmlFor="username">{t("Username")}</label>
                <div className="relative flex items-center">
                  <span aria-hidden="true" className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[20px] pointer-events-none">account_circle</span>
                  <input className="w-full h-12 pl-11 pr-4 bg-surface-container-lowest border border-outline-variant text-on-surface font-body-md text-body-md rounded-lg focus:outline-none focus:border-primary-container focus:bg-surface-container-low transition-colors"
                    id="username" name="username" autoComplete="username" required />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface font-semibold" htmlFor="password">{t("Password")}</label>
                <div className="relative flex items-center">
                  <span aria-hidden="true" className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[20px] pointer-events-none">lock</span>
                  <input className="w-full h-12 pl-11 pr-4 bg-surface-container-lowest border border-outline-variant text-on-surface font-body-md text-body-md rounded-lg focus:outline-none focus:border-primary-container focus:bg-surface-container-low transition-colors"
                    id="password" name="password" type="password" autoComplete="current-password" required />
                </div>
              </div>
              <button className="w-full h-12 bg-primary-container text-on-primary hover:bg-primary font-headline-sm text-headline-sm rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all duration-200 active:scale-[0.99]" type="submit">
                <span>{t("Sign in")}</span>
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
              {!accounts && (
                <p className="font-label-sm text-label-sm text-on-surface-variant -mt-2">{t("Team accounts are coming soon.")}</p>
              )}
            </form>

            {guest && accounts && (
              <>
                <div className="flex items-center gap-3 my-5">
                  <span className="h-px flex-1 bg-outline-variant" />
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t("or")}</span>
                  <span className="h-px flex-1 bg-outline-variant" />
                </div>
                <form method="post" action="/api/auth/signin">
                  <input type="hidden" name="mode" value="guest" />
                  <input type="hidden" name="next" value={next} />
                  <button type="submit" className="w-full h-12 bg-surface-container-low hover:bg-surface-container text-on-surface font-headline-sm text-headline-sm rounded-lg flex items-center justify-center gap-2 transition-colors border border-outline-variant">
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">person_outline</span>
                    <span>{t("Continue without an account")}</span>
                  </button>
                </form>
                <p className="mt-3 font-label-sm text-label-sm text-on-surface-variant text-center">{t("Try the full demo now. You can sign in later.")}</p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between w-full max-w-md mx-auto pt-4 font-label-sm text-label-sm text-on-surface-variant">
          <span>© 2026 SmartPhset</span>
          <span>{t("AI checks are suggestions.")}</span>
        </div>
      </div>
    </div>
  );
}
