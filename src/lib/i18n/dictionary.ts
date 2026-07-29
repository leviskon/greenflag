import "server-only";
import type { Locale } from "./config";
import { ru } from "./ru";

/** Форма словаря задаётся русской версией — остальные языки обязаны её повторить. */
export type Dictionary = typeof ru;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  ru: async () => ru,
  ky: () => import("./ky").then((m) => m.ky),
};

export function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
