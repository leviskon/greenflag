import Link from "next/link";
import { NAV_KEYS } from "@/lib/content";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { LocaleSwitcher } from "./locale-switcher";
import { Cta } from "./ui";

/**
 * Меню на нативном <details>: работает без JavaScript,
 * поэтому не зависит от гидрации на мобильных.
 */
export function SiteHeader({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  return (
    <header className="sticky top-0 z-50 bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href={`/${locale}`}
          className="font-display text-base font-extrabold tracking-tight sm:text-lg"
        >
          Green<span className="text-pink-500">Flag</span>
        </Link>

        <nav aria-label={dict.nav.how} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_KEYS.map((link) => (
              <li key={link.id}>
                <a
                  href={link.href}
                  className="rounded-full px-3.5 py-2 text-sm text-ink-soft transition-colors hover:text-pink-600"
                >
                  {dict.nav[link.id]}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher locale={locale} label={dict.switcher.label} />

          <Cta href={`/${locale}/test`} className="hidden sm:inline-flex">
            {dict.cta.take}
          </Cta>

          <details className="relative lg:hidden">
            <summary
              aria-label={dict.nav.how}
              className="shadow-block grid size-10 place-items-center rounded-full bg-white text-ink"
            >
              <span aria-hidden className="text-base leading-none">
                ☰
              </span>
            </summary>

            <nav
              aria-label={dict.nav.how}
              className="rounded-block shadow-block-lg absolute right-0 z-50 mt-3 w-60 bg-white p-3"
            >
              <ul className="flex flex-col gap-1">
                {NAV_KEYS.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.href}
                      className="block rounded-2xl px-4 py-2.5 text-[15px] font-semibold text-ink-soft transition-colors hover:bg-pink-50 hover:text-pink-600"
                    >
                      {dict.nav[link.id]}
                    </a>
                  </li>
                ))}
                <li className="pt-1 sm:hidden">
                  <Cta href={`/${locale}/test`} className="w-full">
                    {dict.cta.take}
                  </Cta>
                </li>
              </ul>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
