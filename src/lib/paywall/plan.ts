/**
 * Что в отчёте бесплатно, а что за деньги.
 *
 * Модуль общий для сервера и браузера, поэтому здесь только типы и чистые
 * функции: ни ключей, ни хранилища. Смысл разделения — закрытые блоки не
 * должны собираться на клиенте вообще. Их считает сервер и отдаёт готовыми
 * только после подтверждённой оплаты, поэтому в devtools до оплаты нет ни
 * текстов, ни чисел — не только размытой картинки.
 */

import type { Analysis } from "@/lib/ai/analysis";
import type {
  AbuserVerdict,
  BattleRound,
  FlagsReport,
  Report,
  Tone,
} from "@/lib/report";

/** Бесплатные разделы отчёта: совместимость, портрет пары и анатомия. */
export const FREE_BLOCKS = 3;

/** Цена полного отчёта в сомах. Сервер берёт её отсюда же, не от клиента. */
export const REPORT_PRICE = (() => {
  const parsed = Number(process.env.NEXT_PUBLIC_REPORT_PRICE);

  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 199;
})();

export const REPORT_CURRENCY = "KGS";

/**
 * Закрытая часть отчёта: блоки 4–10 в готовом для отрисовки виде.
 *
 * Это не «сырые ответы», а именно результат: клиенту нечего досчитывать, а
 * значит и нечего доставать из хранилища до оплаты.
 */
export type LockedReport = {
  abuser: AbuserVerdict;
  abuserNote: string | null;
  battle: BattleRound[];
  /** Хватило ли данных на баттл: иначе в блоке показывается заглушка. */
  hasBattle: boolean;
  flags: FlagsReport;
  risks: { fight: number; breakup: number };
  cheating: { value: number; tone: Tone; note: string | null };
  dates: string[];
  fun: { film: string; meme: string; cartoon: string } | null;
};

/** Достаём закрытую часть из полного отчёта, собранного на сервере. */
export function lockedFrom(report: Report): LockedReport {
  return {
    abuser: report.abuser,
    abuserNote: report.abuserNote,
    battle: report.battle,
    hasBattle: report.scale.rows.length > 0 || report.blitz.length > 0,
    flags: report.flags,
    risks: report.risks,
    cheating: report.cheating,
    dates: report.dates,
    fun: report.fun,
  };
}

/**
 * Разбор нейросети без закрытой части.
 *
 * Именно это уходит в браузер до оплаты и лежит в localStorage. Форма остаётся
 * прежней (её проверяет guardAnalysis), но всё, что относится к блокам 4–10,
 * обнулено: подсказку про измену или идею для свидания из хранилища не достать.
 */
export function freeAnalysis(analysis: Analysis): Analysis {
  return {
    archetype: analysis.archetype,
    power: analysis.power,
    risk: analysis.risk,
    compatibility: analysis.compatibility,
    metrics: analysis.metrics,
    summary: analysis.summary,
    archetypeText: analysis.archetypeText,
    powerText: analysis.powerText,
    riskText: analysis.riskText,

    // Закрытая часть: пустые значения отчёт переживает — блоки просто не
    // рисуются, а на их месте стоит заглушка «Доступ закрыт».
    battle: {},
    abuser: null,
    fight: null,
    cheating: null,
    abuserNote: "",
    cheatingNote: "",
    dates: [],
    fun: null,
  };
}

/** Ответ /api/report/access и часть ответа /api/report. */
export type AccessPayload = {
  paid: boolean;
  price: number;
  currency: string;
  /** Есть только у оплаченного доступа. */
  locked: LockedReport | null;
  /**
   * Сервер ответил по существу.
   *
   * false — хранилище оплат не отозвалось, и «не оплачено» здесь означает лишь
   * «неизвестно». Оплатившей паре в этом случае нельзя показывать кнопку
   * оплаты: она уже платила.
   */
  ok: boolean;
};

/**
 * Идентификаторы пары и отчёта — это crypto.randomUUID().
 * Проверяем форму, чтобы в хранилище не попадали ключи произвольной длины.
 */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
