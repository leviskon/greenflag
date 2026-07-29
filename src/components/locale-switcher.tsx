import Link from "next/link";
import { LOCALE_LABELS, locales, type Locale } from "@/lib/i18n/config";
import { cn } from "./ui";

/**
 * Переключатель языка на обычных ссылках: работает без JavaScript.
 * `path` — часть адреса после локали, например "" или "/test".
 */
export function LocaleSwitcher({
  locale,
  path = "",
  label,
}: {
  locale: Locale;
  path?: string;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-pink-300 p-1"
    >
      {locales.map((item) => {
        const active = item === locale;

        return (
          <Link
            key={item}
            href={`/${item}${path}`}
            hrefLang={item}
            aria-current={active ? "true" : undefined}
            title={LOCALE_LABELS[item].full}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-[0.06em] transition-colors",
              active
                ? "bg-pink-500 text-white"
                : "text-ink-muted hover:text-pink-600",
            )}
          >
            {LOCALE_LABELS[item].short}
          </Link>
        );
      })}
    </div>
  );
}
