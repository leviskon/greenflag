import Link from "next/link";
import { NAV_KEYS } from "@/lib/content";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { LEGAL_DOCS } from "@/lib/legal";
import { LocaleSwitcher } from "./locale-switcher";

export function SiteFooter({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  return (
    <footer className="mt-auto bg-white">
      <div className="mx-auto w-full max-w-5xl px-4 pt-10 pb-28 sm:px-6 sm:pt-12 lg:pb-12">
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="flex flex-col items-start gap-3">
            <Link
              href={`/${locale}`}
              className="font-display text-base font-extrabold"
            >
              Green<span className="text-pink-500">Flag</span>
            </Link>
            <p className="text-sm leading-relaxed text-ink-soft">
              {dict.footer.about}
            </p>
            <p className="text-xs text-ink-muted">{dict.footer.disclaimer}</p>
            <LocaleSwitcher locale={locale} label={dict.switcher.label} />
          </div>

          <nav aria-label={dict.nav.label} className="flex flex-col gap-2">
            {NAV_KEYS.map((l) => (
              <a
                key={l.id}
                href={l.href}
                className="text-sm text-ink-soft transition-colors hover:text-pink-600"
              >
                {dict.nav[l.id]}
              </a>
            ))}
          </nav>

          {/* Почты и телеграма здесь нет: контакты пока не публикуем. */}
          <div className="flex flex-col gap-1.5">
            {LEGAL_DOCS.map((key) => (
              <Link
                key={key}
                href={`/${locale}/legal/${key}`}
                className="text-xs text-ink-muted transition-colors hover:text-ink-soft"
              >
                {dict.footer.legal[key]}
              </Link>
            ))}
          </div>
        </div>

        <p className="mt-8 text-xs text-ink-muted">
          © {new Date().getFullYear()} GreenFlag
        </p>
      </div>
    </footer>
  );
}
