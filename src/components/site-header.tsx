import Link from "next/link";
import { NAV_KEYS } from "@/lib/content";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { LocaleSwitcher } from "./locale-switcher";
import { Cta } from "./ui";

/**
 * На мобильных хедер минимальный: логотип и переключатель языка.
 * Навигация и кнопка появляются с lg — ниже их роль берут на себя
 * липкая кнопка снизу и ссылки в футере.
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
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <Link
          href={`/${locale}`}
          className="font-display text-base font-extrabold tracking-tight sm:text-lg"
        >
          Green<span className="text-pink-500">Flag</span>
        </Link>

        <nav aria-label={dict.nav.label} className="hidden lg:block">
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

          {/*
            Скрытие вынесено на обёртку, а не на саму кнопку: у Cta в базовых
            классах есть inline-flex, и рядом с hidden выигрывал тот, что стоит
            ниже в собранном CSS, — на телефоне кнопка всё равно показывалась.
            У обёртки display свой, конфликта нет.

            min-w держит ширину кнопки одинаковой на всех языках, иначе
            переключатель смещался бы при смене локали.
          */}
          <span className="hidden lg:block">
            <Cta href={`/${locale}/test`} className="min-w-36">
              {dict.cta.take}
            </Cta>
          </span>
        </div>
      </div>
    </header>
  );
}
