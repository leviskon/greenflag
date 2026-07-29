export const locales = ["ru", "ky"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ru";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Подписи переключателя языков. */
export const LOCALE_LABELS: Record<Locale, { short: string; full: string }> = {
  ru: { short: "RU", full: "Русский" },
  ky: { short: "KY", full: "Кыргызча" },
};
