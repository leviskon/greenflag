import type { Locale } from "./config";
import { ru, type Dictionary } from "./ru";

export type { Dictionary };

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  ru: async () => ru,
  ky: () => import("./ky").then((m) => m.ky),
};

export function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
