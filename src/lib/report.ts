/**
 * Сборка отчёта пары из сохранённых ответов.
 *
 * Это шаблон, а не ИИ: каждое число выводится простым правилом из совпадений
 * ответов, поэтому один и тот же тест всегда даёт один и тот же отчёт.
 * Когда появится настоящая генерация, эти же данные уйдут в модель, а формулы
 * останутся как запасной вариант.
 */

import { COMPATIBILITY } from "@/lib/content";
import type { Dictionary } from "@/lib/i18n/ru";
import { isAnswered, type TestState } from "@/lib/storage";

type Quiz = Dictionary["quiz"];
type Question = Quiz["questions"][number];

/** Позиций на шкале «или — или»: 1 — крайний левый вариант, 7 — крайний правый. */
const SCALE_STEPS = 7;
const SCALE_SPAN = SCALE_STEPS - 1;

/** Текстовые вопросы в том порядке, в котором показываем цитаты. */
const QUOTE_IDS = [
  "stranger",
  "value",
  "peace",
  "critique",
  "annoy",
  "jealousy",
  "change-behavior",
  "disagree",
  "lastday",
] as const;

/** Метрики, у которых «меньше — лучше». */
const NEGATIVE_METRICS = new Set(["irritation", "toxicity"]);

export type Tone = "good" | "mid" | "bad";
export type MetricId = keyof Dictionary["anatomy"]["metrics"];
export type Verdict = "ok" | "bad";
export type MatchKind = "match" | "close" | "clash";

export type Metric = { id: MetricId; value: number; tone: Tone };

export type ScaleRow = {
  index: number;
  left: string;
  right: string;
  she: number;
  he: number;
  distance: number;
  kind: MatchKind;
};

export type BlitzRow = {
  index: number;
  statement: string;
  she: Verdict;
  he: Verdict;
  agree: boolean;
};

export type ChoiceRow = { option: string; she: boolean; he: boolean };

export type Quote = { id: string; question: string; she: string; he: string };

export type Report = {
  /** Есть ли хоть один заполненный ответ: иначе показываем пустое состояние. */
  hasData: boolean;
  names: { she: string; he: string };
  since: string;
  answered: number;
  total: number;
  compatibility: number;
  compatTone: Tone;
  archetype: number;
  metrics: Metric[];
  flags: {
    agree: number;
    clash: number;
    strictShe: number;
    strictHe: number;
    total: number;
  };
  scale: { rows: ScaleRow[]; matches: ScaleRow[]; clashes: ScaleRow[] };
  blitz: BlitzRow[];
  style: ChoiceRow[];
  goals: ChoiceRow[];
  quotes: Quote[];
  risks: { fight: number; breakup: number };
};

const METRIC_ORDER: MetricId[] = [
  "trust",
  "values",
  "humor",
  "sex",
  "self",
  "irritation",
  "toxicity",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Средняя доля 0…1 или null, если считать нечего. */
function share(values: number[]): number | null {
  if (values.length === 0) return null;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Взвешенная смесь доступных сигналов. Пропущенные просто не учитываются. */
function mix(parts: Array<[number | null, number]>): number {
  let total = 0;
  let weight = 0;

  for (const [value, partWeight] of parts) {
    if (value === null) continue;
    total += value * partWeight;
    weight += partWeight;
  }

  return weight === 0 ? 0.5 : total / weight;
}

/** Доля 0…1 → проценты в осмысленном диапазоне: 0% и 100% выглядят фальшиво. */
function toPercent(value: number, low = 28, high = 96): number {
  return Math.round(low + clamp(value, 0, 1) * (high - low));
}

function toneOf(id: MetricId, value: number): Tone {
  if (NEGATIVE_METRICS.has(id)) {
    if (value <= 35) return "good";
    return value <= 60 ? "mid" : "bad";
  }

  if (value >= 70) return "good";
  return value >= 45 ? "mid" : "bad";
}

type ScaleQuestion = Extract<Question, { type: "scale" }>;
type VerdictQuestion = Extract<Question, { type: "verdict" }>;
type ChoiceQuestion = Extract<Question, { type: "multiple-choice" }>;

function findQuestion(quiz: Quiz, id: string): Question | undefined {
  return quiz.questions.find((question) => question.id === id);
}

/**
 * Тип шага определяется полем type, поэтому сужаем через него: проверка
 * «есть ли поле pairs» оставляет свойства опциональными.
 */
function isScale(question: Question): question is ScaleQuestion {
  return "type" in question && question.type === "scale";
}

function isVerdict(question: Question): question is VerdictQuestion {
  return "type" in question && question.type === "verdict";
}

function isChoice(question: Question): question is ChoiceQuestion {
  return "type" in question && question.type === "multiple-choice";
}

/** «3,7,1» → [3, 7, 1]; пустой слот — null. */
function parseNumbers(value: string): (number | null)[] {
  if (!value) return [];

  return value.split(",").map((part) => {
    const parsed = Number(part);
    return part.trim() !== "" && Number.isFinite(parsed) ? parsed : null;
  });
}

function parseVerdicts(value: string): (Verdict | null)[] {
  if (!value) return [];

  return value.split(",").map((part) => {
    const token = part.trim();
    return token === "ok" || token === "bad" ? token : null;
  });
}

function kindOf(distance: number): MatchKind {
  if (distance <= 1) return "match";
  return distance <= 3 ? "close" : "clash";
}

function buildScale(state: TestState, quiz: Quiz): ScaleRow[] {
  const question = quiz.questions.find(isScale);
  if (!question) return [];

  const saved = state.answers[question.id];
  if (!saved) return [];

  const she = parseNumbers(saved.she);
  const he = parseNumbers(saved.he);

  return question.pairs.flatMap((pair, index) => {
    const sheValue = she[index];
    const heValue = he[index];
    if (sheValue == null || heValue == null) return [];

    const distance = Math.abs(sheValue - heValue);

    return [
      {
        index,
        left: pair.left,
        right: pair.right,
        she: sheValue,
        he: heValue,
        distance,
        kind: kindOf(distance),
      },
    ];
  });
}

function buildBlitz(state: TestState, quiz: Quiz): BlitzRow[] {
  const question = quiz.questions.find(isVerdict);
  if (!question) return [];

  const saved = state.answers[question.id];
  if (!saved) return [];

  const she = parseVerdicts(saved.she);
  const he = parseVerdicts(saved.he);

  return question.statements.flatMap((statement, index) => {
    const sheValue = she[index];
    const heValue = he[index];
    if (!sheValue || !heValue) return [];

    return [
      {
        index,
        statement,
        she: sheValue,
        he: heValue,
        agree: sheValue === heValue,
      },
    ];
  });
}

function buildChoices(
  state: TestState,
  quiz: Quiz,
  questionId: string,
): ChoiceRow[] {
  const question = findQuestion(quiz, questionId);
  if (!question || !isChoice(question)) return [];

  const saved = state.answers[question.id];
  if (!saved) return [];

  const she = new Set(parseNumbers(saved.she));
  const he = new Set(parseNumbers(saved.he));

  return question.options.flatMap((option, index) => {
    const pickedShe = she.has(index);
    const pickedHe = he.has(index);
    if (!pickedShe && !pickedHe) return [];

    return [{ option, she: pickedShe, he: pickedHe }];
  });
}

function buildQuotes(state: TestState, quiz: Quiz): Quote[] {
  return QUOTE_IDS.flatMap((id) => {
    const question = findQuestion(quiz, id);
    const saved = state.answers[id];
    if (!question || !saved) return [];

    const she = saved.she.trim();
    const he = saved.he.trim();
    if (!she && !he) return [];

    return [{ id, question: question.text, she, he }];
  });
}

/** Насколько близки позиции на шкале: 1 — вплотную, 0 — по разным краям. */
function closeness(rows: ScaleRow[], indices?: number[]): number | null {
  const picked = indices
    ? rows.filter((row) => indices.includes(row.index))
    : rows;

  return share(picked.map((row) => 1 - row.distance / SCALE_SPAN));
}

/** Доля совпавших вердиктов в блиц-опросе. */
function agreement(rows: BlitzRow[], indices?: number[]): number | null {
  const picked = indices
    ? rows.filter((row) => indices.includes(row.index))
    : rows;

  return share(picked.map((row) => (row.agree ? 1 : 0)));
}

/** Насколько вариант отмечен: оба — 1, один — 0.5, никто — 0, нет варианта — null. */
function pickedAt(rows: ChoiceRow[], options: string[], index: number) {
  const option = options[index];
  if (option === undefined) return null;

  const row = rows.find((item) => item.option === option);
  if (!row) return 0;

  return row.she && row.he ? 1 : 0.5;
}

function optionsOf(quiz: Quiz, questionId: string): string[] {
  const question = findQuestion(quiz, questionId);

  return question && isChoice(question) ? [...question.options] : [];
}

/** Пересечение выборов: сколько из отмеченных вариантов выбрали оба. */
function overlap(rows: ChoiceRow[]): number | null {
  if (rows.length === 0) return null;

  return rows.filter((row) => row.she && row.he).length / rows.length;
}

/** Стабильный номер архетипа: одинаковые ответы — одинаковый архетип. */
function hashIndex(state: TestState, length: number): number {
  const source = Object.entries(state.answers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, answer]) => `${id}:${answer.she}|${answer.he}`)
    .join("~");

  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 100003;
  }

  return length === 0 ? 0 : hash % length;
}

function slotsOf(question: Question): number {
  if (isScale(question)) return question.pairs.length;
  if (isVerdict(question)) return question.statements.length;

  return 1;
}

export function buildReport(
  state: TestState,
  quiz: Quiz,
  archetypes: number,
): Report {
  const scaleRows = buildScale(state, quiz);
  const blitz = buildBlitz(state, quiz);
  const style = buildChoices(state, quiz, "relationship-style");
  const goals = buildChoices(state, quiz, "level-up");
  const quotes = buildQuotes(state, quiz);

  const styleOptions = optionsOf(quiz, "relationship-style");
  const goalOptions = optionsOf(quiz, "level-up");

  const answered = quiz.questions.filter((question) =>
    isAnswered(state, question.id, slotsOf(question)),
  ).length;

  const allCloseness = closeness(scaleRows);
  const allAgreement = agreement(blitz);
  const styleOverlap = overlap(style);
  const goalOverlap = overlap(goals);

  const clashShare =
    scaleRows.length === 0
      ? null
      : scaleRows.filter((row) => row.kind === "clash").length /
        scaleRows.length;

  const hasData =
    scaleRows.length > 0 ||
    blitz.length > 0 ||
    style.length > 0 ||
    goals.length > 0 ||
    quotes.length > 0;

  const compatibility = hasData
    ? clamp(
        toPercent(
          mix([
            [allCloseness, 0.45],
            [allAgreement, 0.35],
            [styleOverlap, 0.1],
            [goalOverlap, 0.1],
          ]),
          35,
          95,
        ),
        35,
        95,
      )
    : COMPATIBILITY;

  // Каждая метрика собирается из своих вопросов: так числа не повторяют
  // друг друга и их можно объяснить пользователю.
  const rawMetrics: Record<MetricId, number> = {
    trust: mix([
      [agreement(blitz, [1, 4, 5]), 0.6],
      [allAgreement, 0.4],
    ]),
    values: mix([
      [closeness(scaleRows, [1, 8]), 0.5],
      [agreement(blitz, [8, 9]), 0.3],
      [styleOverlap, 0.2],
    ]),
    humor: mix([
      [pickedAt(style, styleOptions, 3), 0.3],
      [pickedAt(style, styleOptions, 5), 0.3],
      [pickedAt(goals, goalOptions, 7), 0.2],
      [allCloseness, 0.2],
    ]),
    sex: mix([
      [closeness(scaleRows, [2]), 0.4],
      [pickedAt(style, styleOptions, 7), 0.3],
      [pickedAt(goals, goalOptions, 3), 0.3],
    ]),
    self: mix([
      [closeness(scaleRows, [4, 6]), 0.5],
      [agreement(blitz, [0, 2]), 0.5],
    ]),
    irritation: mix([
      [allAgreement === null ? null : 1 - allAgreement, 0.5],
      [pickedAt(style, styleOptions, 0), 0.25],
      [pickedAt(goals, goalOptions, 1), 0.25],
    ]),
    toxicity: mix([
      [clashShare, 0.5],
      [pickedAt(style, styleOptions, 10), 0.3],
      [allAgreement === null ? null : 1 - allAgreement, 0.2],
    ]),
  };

  const metrics: Metric[] = METRIC_ORDER.map((id) => {
    const value = toPercent(rawMetrics[id]);

    return { id, value, tone: toneOf(id, value) };
  });

  const matches = [...scaleRows]
    .filter((row) => row.kind !== "clash")
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  const clashes = [...scaleRows]
    .filter((row) => row.kind === "clash")
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 3);

  return {
    hasData,
    names: { she: state.profile.she.name, he: state.profile.he.name },
    since: state.profile.since,
    answered,
    total: quiz.questions.length,
    compatibility,
    compatTone: compatibility >= 70 ? "good" : compatibility >= 50 ? "mid" : "bad",
    archetype: hashIndex(state, archetypes),
    metrics,
    flags: {
      agree: blitz.filter((row) => row.agree).length,
      clash: blitz.filter((row) => !row.agree).length,
      strictShe: blitz.filter((row) => row.she === "bad").length,
      strictHe: blitz.filter((row) => row.he === "bad").length,
      total: blitz.length,
    },
    scale: { rows: scaleRows, matches, clashes },
    blitz,
    style,
    goals,
    quotes,
    risks: {
      fight: clamp(
        toPercent(
          mix([
            [allAgreement === null ? null : 1 - allAgreement, 0.6],
            [clashShare, 0.4],
          ]),
          20,
          85,
        ),
        20,
        85,
      ),
      breakup: clamp(105 - compatibility, 15, 80),
    },
  };
}

/** «2021-03» → «03.2021». Без склонений: они у языков разные. */
export function formatSince(since: string): string {
  const [year, month] = since.split("-");

  return year && month ? `${month}.${year}` : since;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${day}.${month}.${date.getFullYear()}`;
}

export { SCALE_STEPS };
