import Link from "next/link";
import { NAV_KEYS } from "@/lib/content";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { LocaleSwitcher } from "./locale-switcher";

const LEGAL_KEYS = ["terms", "privacy", "offer"] as const;

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

          <nav aria-label={dict.nav.report} className="flex flex-col gap-2">
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

          <div className="flex flex-col gap-2">
            <a
              href="mailto:support@greenflag.app"
              className="text-sm text-ink-soft transition-colors hover:text-pink-600"
            >
              support@greenflag.app
            </a>
            <a
              href="https://t.me/greenflag_support"
              className="text-sm text-ink-soft transition-colors hover:text-pink-600"
            >
              @greenflag_support
            </a>
            <div className="mt-2 flex flex-col gap-1.5">
              {LEGAL_KEYS.map((key) => (
                <a
                  key={key}
                  href="#"
                  className="text-xs text-ink-muted transition-colors hover:text-ink-soft"
                >
                  {dict.footer.legal[key]}
                </a>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-8 text-xs text-ink-muted">
          © {new Date().getFullYear()} GreenFlag
        </p>
      </div>
    </footer>
  );
}
