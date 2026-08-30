/**
 * Контракт ответа нейросети и его проверка.
 *
 * Модель отвечает короткими ключами и номерами меток — так дешевле по токенам
 * и меньше поводов для опечатки в длинном id. Здесь ответ превращается в
 * типизированный объект: всё, что не прошло проверку, отбрасывается, и отчёт
 * в этом месте считается по формулам.
 *
 * Правило простое: наружу не уходит ни одного числа, которое мы не проверили.
 */

import {
  ARCHETYPE_IDS,
  POWER_IDS,
  RISK_IDS,
  type ArchetypeId,
  type PowerId,
  type RiskId,
} from "@/lib/content";
import type { AbuserVerdict, BattleId, MetricId } from "@/lib/report";

/** Версия формата: несовпадение — повод пересчитать, а не читать старое. */
export const ANALYSIS_VERSION = 1;

/** Порядок фиксирован: он же уходит в промпт и в проверку ответа. */
export const METRIC_KEYS = [
  "trust",
  "values",
  "humor",
  "sex",
  "self",
  "irritation",
  "toxicity",
] as const satisfies readonly MetricId[];

export const BATTLE_KEYS = [
  "love",
  "boss",
  "understand",
  "boring",
  "toxic",
  "wise",
  "manipulator",
  "codependent",
] as const satisfies readonly BattleId[];

const ABUSER_VALUES = ["nobody", "she", "he", "both"] as const;

/** Границы процентов: ровно 0 и 100 выглядят как сбой, поэтому обрезаем. */
const MIN_PCT = 5;
const MAX_PCT = 99;

/**
 * Жёсткий предел длины. В промпте просим короче (180 и 140), поэтому
 * небольшой перебор проходит целиком и обрезать почти никогда не приходится.
 */
const MAX_SUMMARY = 220;
const MAX_NOTE = 170;

/** Текст к архетипу, силе и риску. В промпте просим до 200. */
const MAX_PORTRAIT = 260;

/** Строка списка: идея для свидания, фильм, мем. В промпте просим до 90. */
const MAX_LINE = 130;

/** Больше пяти идей для свиданий блок не показывает. */
const MAX_DATES = 5;

export type Analysis = {
  archetype: ArchetypeId;
  power: PowerId;
  risk: RiskId;
  compatibility: number;
  /** Проценты метрик. Ключ отсутствует — значение берётся из формулы. */
  metrics: Partial<Record<MetricId, number>>;
  battle: Partial<Record<BattleId, number>>;
  abuser: AbuserVerdict | null;
  fight: number | null;
  /** Вероятность измены. Без неё в отчёте останется число из формулы. */
  cheating: number | null;
  summary: string;
  abuserNote: string;
  cheatingNote: string;
  /**
   * Тексты к выбранным метке архетипа, силы и риска.
   *
   * Каждый годится только вместе со своей меткой: если отчёт заменит метку
   * своей (модель предложила несочетаемую пару «сила + риск»), текст к ней уже
   * не относится и в отчёт не попадёт.
   */
  archetypeText: string;
  powerText: string;
  riskText: string;
  /** Идеи для свиданий: формулой их не соберёшь, только модель. */
  dates: string[];
  /** Фильм, мем и мультфильм про пару. Тоже только от модели. */
  fun: { film: string; meme: string; cartoon: string } | null;
};

/** Целое в разумных границах или null, если пришёл мусор. */
function percent(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return null;

  const rounded = Math.round(parsed);
  if (rounded < 0 || rounded > 100) return null;

  return Math.min(Math.max(rounded, MIN_PCT), MAX_PCT);
}

/** Номер метки 1…length → сам id. Всё остальное — null. */
function pickByIndex<Id extends string>(
  value: unknown,
  list: readonly Id[],
): Id | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed)) return null;

  return list[parsed - 1] ?? null;
}

/** Одна строка без переносов, обрезанная по длине по-человечески. */
function text(value: unknown, limit: number): string {
  if (typeof value !== "string") return "";

  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;

  const cut = clean.slice(0, limit);

  // Лучший вариант — закончить на конце предложения.
  const sentence = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf("! "),
    cut.lastIndexOf("? "),
  );
  if (sentence > limit * 0.5) return cut.slice(0, sentence + 1).trim();

  // Иначе — по слову, без висящей запятой или тире на конце.
  const space = cut.lastIndexOf(" ");
  const words = space > limit * 0.6 ? cut.slice(0, space) : cut;

  return `${words.trim().replace(/[\s,;:.—–-]+$/u, "")}…`;
}

/** Список коротких строк: пустые отбрасываем, лишние отрезаем. */
function linesOf(value: unknown, limit: number, max: number): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => text(item, limit))
    .filter((item) => item.length > 0)
    .slice(0, max);
}

/**
 * Фильм, мем и мультфильм. Нужны все три: блок из одной заполненной строки
 * выглядит как сбой, а не как часть отчёта.
 */
function funOf(value: unknown): Analysis["fun"] {
  if (typeof value !== "object" || value === null) return null;

  const raw = value as Record<string, unknown>;

  const film = text(raw.film, MAX_LINE);
  const meme = text(raw.meme, MAX_LINE);
  const cartoon = text(raw.cartoon, MAX_LINE);

  return film && meme && cartoon ? { film, meme, cartoon } : null;
}

function numbersOf<Key extends string>(
  value: unknown,
  keys: readonly Key[],
): Partial<Record<Key, number>> {
  if (typeof value !== "object" || value === null) return {};

  const source = value as Record<string, unknown>;
  const result: Partial<Record<Key, number>> = {};

  for (const key of keys) {
    const parsed = percent(source[key]);
    if (parsed !== null) result[key] = parsed;
  }

  return result;
}

/**
 * Разбор ответа модели. Обязательны только три метки и совместимость: без них
 * отчёт всё равно собирается по формулам, и подмешивать половину нечего.
 */
export function parseAnalysis(value: unknown): Analysis | null {
  if (typeof value !== "object" || value === null) return null;

  const raw = value as Record<string, unknown>;

  const archetype = pickByIndex(raw.a, ARCHETYPE_IDS);
  const power = pickByIndex(raw.p, POWER_IDS);
  const risk = pickByIndex(raw.r, RISK_IDS);
  const compatibility = percent(raw.c);

  if (!archetype || !power || !risk || compatibility === null) return null;

  // null, а не «nobody»: пропущенный вердикт должен взяться из формулы, иначе
  // молчание модели превратилось бы в «абьюзеров нет».
  const abuser = ABUSER_VALUES.find((item) => item === raw.ab) ?? null;

  return {
    archetype,
    power,
    risk,
    compatibility,
    metrics: numbersOf(raw.m, METRIC_KEYS),
    battle: numbersOf(raw.b, BATTLE_KEYS),
    abuser,
    fight: percent(raw.f),
    cheating: percent(raw.ch),
    summary: text(raw.s, MAX_SUMMARY),
    abuserNote: text(raw.an, MAX_NOTE),
    cheatingNote: text(raw.chn, MAX_NOTE),
    archetypeText: text(raw.at, MAX_PORTRAIT),
    powerText: text(raw.pt, MAX_PORTRAIT),
    riskText: text(raw.rt, MAX_PORTRAIT),
    dates: linesOf(raw.d, MAX_LINE, MAX_DATES),
    fun: funOf(raw.fu),
  };
}

/**
 * Проверка уже разобранного анализа — того, что лежит в localStorage.
 *
 * Хранилище правится руками, поэтому читаем его так же недоверчиво, как ответ
 * модели: иначе в отчёт попадут проценты вида 900 или чужая метка.
 */
export function guardAnalysis(value: unknown): Analysis | null {
  if (typeof value !== "object" || value === null) return null;

  const raw = value as Record<string, unknown>;

  const archetype = ARCHETYPE_IDS.find((id) => id === raw.archetype);
  const power = POWER_IDS.find((id) => id === raw.power);
  const risk = RISK_IDS.find((id) => id === raw.risk);
  const compatibility = percent(raw.compatibility);

  if (!archetype || !power || !risk || compatibility === null) return null;

  return {
    archetype,
    power,
    risk,
    compatibility,
    metrics: numbersOf(raw.metrics, METRIC_KEYS),
    battle: numbersOf(raw.battle, BATTLE_KEYS),
    abuser: ABUSER_VALUES.find((item) => item === raw.abuser) ?? null,
    fight: percent(raw.fight),
    cheating: percent(raw.cheating),
    summary: text(raw.summary, MAX_SUMMARY),
    abuserNote: text(raw.abuserNote, MAX_NOTE),
    cheatingNote: text(raw.cheatingNote, MAX_NOTE),
    archetypeText: text(raw.archetypeText, MAX_PORTRAIT),
    powerText: text(raw.powerText, MAX_PORTRAIT),
    riskText: text(raw.riskText, MAX_PORTRAIT),
    dates: linesOf(raw.dates, MAX_LINE, MAX_DATES),
    fun: funOf(raw.fun),
  };
}

/** Ответ модели приходит текстом: достаём из него объект JSON. */
export function parseAnalysisText(body: string): Analysis | null {
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    return parseAnalysis(JSON.parse(body.slice(start, end + 1)));
  } catch {
    return null;
  }
}
