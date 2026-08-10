import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LOCALE_LABELS, type Locale } from "@/lib/i18n/config";

/**
 * Хедер страниц теста. Пока тест не начат, язык ещё можно переключить;
 * как только данные пары сохранены, язык фиксируется — иначе ответы
 * собирались бы на двух языках.
 */
export function TestHeader({
  locale,
  path,
  switcherLabel,
  locked,
  lockedLabel,
}: {
  locale: Locale;
  path: string;
  switcherLabel: string;
  locked: boolean;
  lockedLabel: string;
}) {
  return (
    <header className="flex h-12 w-full shrink-0 items-center justify-between gap-3">
      <Link
        href={`/${locale}`}
        className="font-display text-base font-extrabold tracking-tight sm:text-lg"
      >
        Green<span className="text-pink-500">Flag</span>
      </Link>

      {locked ? (
        <span
          title={lockedLabel}
          aria-label={`${lockedLabel}: ${LOCALE_LABELS[locale].full}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink-muted/50 px-3 py-1 text-[11px] font-extrabold tracking-[0.06em] text-ink-muted"
        >
          <LockIcon />
          {LOCALE_LABELS[locale].short}
        </span>
      ) : (
        <LocaleSwitcher locale={locale} path={path} label={switcherLabel} />
      )}
    </header>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3"
      aria-hidden
    >
      <rect x="4" y="10" width="16" height="10" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
