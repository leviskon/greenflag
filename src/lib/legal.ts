/**
 * Правовые страницы: адреса документов и то, что подставляется в тексты.
 *
 * Реквизитов и контактов здесь намеренно нет — документы написаны так, чтобы
 * не ссылаться на них. Когда появится юрлицо и рабочая почта, сюда добавляются
 * поля, а в словарях правятся разделы про оператора и обращения.
 */

/** Адреса вида /ru/legal/offer. Ключи совпадают с ключами в словаре. */
export const LEGAL_DOCS = ["offer", "terms", "privacy"] as const;

export type LegalDoc = (typeof LEGAL_DOCS)[number];

export const LEGAL = {
  /** Дата последней правки документов. Меняется вручную вместе с текстом. */
  updated: "2026-08-28",
  /** Поставщик ИИ, которому уходят ответы: это раскрывается в политике. */
  aiProvider: "Anthropic PBC (США)",
} as const;

export function isLegalDoc(value: string): value is LegalDoc {
  return (LEGAL_DOCS as readonly string[]).includes(value);
}

/** «2026-08-28» → «28.08.2026». Порядок одинаковый для обоих языков. */
export function formatLegalDate(iso: string): string {
  const [year, month, day] = iso.split("-");

  return year && month && day ? `${day}.${month}.${year}` : iso;
}
