/**
 * Сборка отчёта пары из сохранённых ответов.
 *
 * Это шаблон, а не ИИ: каждое число выводится простым правилом из совпадений
 * ответов, поэтому один и тот же тест всегда даёт один и тот же отчёт.
 * Когда появится настоящая генерация, эти же данные уйдут в модель, а формулы
 * останутся как запасной вариант.
 */

import {
  ARCHETYPE_IDS,
  ARCHETYPE_MATCH,
  COMPATIBILITY,
  powersFor,
  type ArchetypeId,
  type PowerId,
  type RiskId,
} from "@/lib/content";
import type { Dictionary } from "@/lib/i18n/ru";
import { isAnswered, type Participant, type TestState } from "@/lib/storage";
import type { Analysis } from "@/lib/ai/analysis";

type Quiz = Dictionary["quiz"];
type Question = Quiz["questions"][number];

/** Позиций на шкале «или — или»: 1 — крайний левый вариант, 7 — крайний правый. */
const SCALE_STEPS = 7;
const SCALE_SPAN = SCALE_STEPS - 1;

/** Метрики, у которых «меньше — лучше». */
const NEGATIVE_METRICS = new Set(["irritation", "toxicity"]);

/**
 * Правила флагов в блиц-опросе: что значит «норм» и что значит «стрем».
 * null — утверждение во флаги не идёт.
 *
 * Утверждение 8 («мужчина должен обеспечивать семью») намеренно нейтральное:
 * это вопрос семейного уклада, а не здоровья отношений, и в разных культурах
 * ответ разный. Оно всё равно работает в других блоках — там, где мы смотрим
 * на совпадение ответов, а не на их «правильность».
 */
const BLITZ_FLAGS: Record<number, { ok: Flag | null; bad: Flag | null }> = {
  0: { ok: "green", bad: "red" }, // дружить с противоположным полом
  1: { ok: "red", bad: "green" }, // знать пароли друг друга
  2: { ok: "green", bad: "red" }, // отпуск раздельно
  3: { ok: "red", bad: "green" }, // обсуждать ссоры с друзьями
  4: { ok: "red", bad: "green" }, // читать переписки партнёра
  5: { ok: "red", bad: "green" }, // всегда делиться геолокацией
  6: { ok: "red", bad: "green" }, // засыпать не помирившись
  7: { ok: "green", bad: "red" }, // фото и видео в купальнике
  8: { ok: null, bad: null }, // мужчина обеспечивает семью — вопрос уклада
  9: { ok: "green", bad: "red" }, // быт — общая ответственность
};

/** Выбранный стиль отношений: часть вариантов сама по себе флаг. */
const STYLE_FLAGS: Record<number, Flag> = {
  0: "red", // часто ссоримся
  2: "green", // дома вдвоём
  4: "green", // почти никогда не ругаемся
  5: "green", // не бывает скучно
  6: "green", // романтика и милые жесты
  7: "green", // секс — сильная сторона
  8: "green", // заряжают большие цели
  10: "red", // то сближаемся, то отдаляемся
};

/** Что хотят прокачать: это признание дефицита, поэтому часть — ред флаги. */
const GOAL_FLAGS: Record<number, Flag> = {
  1: "red", // меньше ссор и больше терпения
  6: "red", // больше доверия
  9: "red", // больше личного пространства
  10: "red", // больше поддержки и благодарности
  11: "green", // ничего не менял бы
};

/** Шкала «или — или»: флаг даёт только явный крен к краю. */
const SCALE_FLAGS: Record<number, { left: Flag; right: Flag }> = {
  3: { left: "green", right: "red" }, // чьи мысли читаем
  6: { left: "red", right: "green" }, // лояльность против объективности
};

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

/** Кто в паре перегибает с контролем. «both» — оба, «nobody» — никто. */
export type AbuserVerdict = "nobody" | "she" | "he" | "both";

export type Flag = "green" | "red";
export type FlagCount = { green: number; red: number };

export type FlagsReport = {
  she: FlagCount;
  he: FlagCount;
  /** Сумма по паре: её показываем строкой под колонками. */
  total: FlagCount;
  /** Кому досталось звание. null — счёт равный. */
  greenHolder: Participant | null;
  redHolder: Participant | null;
};

export type BattleId = keyof Dictionary["battle"]["rounds"];

/**
 * Раунд баттла: `value` — позиция ползунка в процентах.
 * 0 — целиком она, 100 — целиком он, 50 — ровно посередине.
 */
export type BattleRound = { id: BattleId; value: number };

export type Report = {
  /** Есть ли хоть один заполненный ответ: иначе показываем пустое состояние. */
  hasData: boolean;
  /** Чем посчитан отчёт: разбором нейросети или формулами. */
  source: "ai" | "template";
  /** Короткий вывод от модели. Без неё null — блок просто не показываем. */
  summary: string | null;
  /** Комментарий к вердикту про контроль. Без модели берётся из словаря. */
  abuserNote: string | null;
  /**
   * Тексты слайдов портрета. null у любого из трёх — показываем описание метки
   * из словаря: либо модель не ответила, либо её метку пришлось пересчитать.
   */
  portrait: {
    archetype: string | null;
    power: string | null;
    risk: string | null;
  };
  names: { she: string; he: string };
  since: string;
  answered: number;
  total: number;
  compatibility: number;
  compatTone: Tone;
  archetype: ArchetypeId;
  power: PowerId;
  risk: RiskId;
  metrics: Metric[];
  abuser: AbuserVerdict;
  flags: FlagsReport;
  battle: BattleRound[];
  scale: { rows: ScaleRow[]; matches: ScaleRow[]; clashes: ScaleRow[] };
  blitz: BlitzRow[];
  risks: { fight: number; breakup: number };
  /** Вероятность измены. Число есть всегда, объяснение — только от модели. */
  cheating: { value: number; tone: Tone; note: string | null };
  /** Идеи для свиданий. Пусто, если разбора нет: формулой их не придумать. */
  dates: string[];
  /** Фильм, мем и мультфильм про пару. Без разбора null. */
  fun: { film: string; meme: string; cartoon: string } | null;
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

/**
 * Насколько вариант отмечен: оба — 1, один — 0.5, никто — 0.
 *
 * null — считать нечего: вопрос не пройден или варианта нет в словаре. Отличать
 * это от «никто не выбрал» обязательно: иначе непройденный вопрос читается как
 * осознанный отказ и тянет метрики вниз (а в перевёрнутых сигналах — вверх).
 */
function pickedAt(rows: ChoiceRow[], options: string[], index: number) {
  const option = options[index];
  if (option === undefined) return null;
  if (rows.length === 0) return null;

  const row = rows.find((item) => item.option === option);
  if (!row) return 0;

  return row.she && row.he ? 1 : 0.5;
}

/** Перевёрнутый сигнал: «хотим больше X» — это признание нехватки X. */
function lack(value: number | null): number | null {
  return value === null ? null : 1 - value;
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

/**
 * Склонность к контролю у одной стороны, 0…1.
 *
 * Считаем по четырём признакам: считает нормой залезть в личное партнёра,
 * запрещает партнёру личное пространство, требует безусловной лояльности
 * в спорах и хочет читать мысли партнёра, а не открывать свои.
 */
function controlScore(
  side: Participant,
  blitz: BlitzRow[],
  scale: ScaleRow[],
): number {
  const intrusive = share(
    blitz
      .filter((row) => [1, 4, 5].includes(row.index))
      .map((row) => (row[side] === "ok" ? 1 : 0)),
  );

  const restrictive = share(
    blitz
      .filter((row) => [0, 2, 7].includes(row.index))
      .map((row) => (row[side] === "bad" ? 1 : 0)),
  );

  // «Всегда быть за меня» — левый край шкалы, поэтому считаем от семёрки.
  const loyalty = scale
    .filter((row) => row.index === 6)
    .map((row) => (SCALE_STEPS - row[side]) / SCALE_SPAN)[0];

  // «Я могу слышать твои мысли» — правый край.
  const mindRead = scale
    .filter((row) => row.index === 3)
    .map((row) => (row[side] - 1) / SCALE_SPAN)[0];

  return mix([
    [intrusive, 0.35],
    [restrictive, 0.35],
    [loyalty ?? null, 0.15],
    [mindRead ?? null, 0.15],
  ]);
}

function abuserVerdict(blitz: BlitzRow[], scale: ScaleRow[]): AbuserVerdict {
  // Данных нет — обвинять некого.
  if (blitz.length === 0 && scale.length === 0) return "nobody";

  const she = controlScore("she", blitz, scale);
  const he = controlScore("he", blitz, scale);

  const HIGH = 0.55;
  const GAP = 0.12;

  if (she < HIGH && he < HIGH) return "nobody";
  if (she >= HIGH && he >= HIGH) return "both";
  if (she >= HIGH && she - he >= GAP) return "she";
  if (he >= HIGH && he - she >= GAP) return "he";

  return "both";
}

/** Отмечал ли участник вариант с этим номером. */
function isPicked(
  rows: ChoiceRow[],
  options: string[],
  index: number,
  side: Participant,
): boolean {
  const option = options[index];
  if (option === undefined) return false;

  return rows.find((row) => row.option === option)?.[side] ?? false;
}

function countFlags(
  side: Participant,
  blitz: BlitzRow[],
  scale: ScaleRow[],
  style: ChoiceRow[],
  styleOptions: string[],
  goals: ChoiceRow[],
  goalOptions: string[],
): FlagCount {
  const count: FlagCount = { green: 0, red: 0 };
  const add = (flag: Flag | null | undefined) => {
    if (flag) count[flag] += 1;
  };

  for (const row of blitz) {
    const rule = BLITZ_FLAGS[row.index];
    if (rule) add(row[side] === "ok" ? rule.ok : rule.bad);
  }

  for (const row of scale) {
    const rule = SCALE_FLAGS[row.index];
    if (!rule) continue;

    // Середина шкалы — не позиция, а её отсутствие: флага не даём.
    if (row[side] <= 2) add(rule.left);
    else if (row[side] >= 6) add(rule.right);
  }

  for (const [index, flag] of Object.entries(STYLE_FLAGS)) {
    if (isPicked(style, styleOptions, Number(index), side)) add(flag);
  }

  for (const [index, flag] of Object.entries(GOAL_FLAGS)) {
    if (isPicked(goals, goalOptions, Number(index), side)) add(flag);
  }

  return count;
}

/**
 * Звания получает тот, у кого лучше и хуже баланс «грин минус ред»:
 * по одному числу сравнивать честнее, чем по количеству грин флагов.
 */
function buildFlags(
  blitz: BlitzRow[],
  scale: ScaleRow[],
  style: ChoiceRow[],
  styleOptions: string[],
  goals: ChoiceRow[],
  goalOptions: string[],
): FlagsReport {
  const she = countFlags("she", blitz, scale, style, styleOptions, goals, goalOptions);
  const he = countFlags("he", blitz, scale, style, styleOptions, goals, goalOptions);

  const balanceShe = she.green - she.red;
  const balanceHe = he.green - he.red;

  const greenHolder: Participant | null =
    balanceShe === balanceHe ? null : balanceShe > balanceHe ? "she" : "he";

  return {
    she,
    he,
    total: { green: she.green + he.green, red: she.red + he.red },
    greenHolder,
    redHolder: greenHolder === null ? null : greenHolder === "she" ? "he" : "she",
  };
}

/** Позиция на шкале как доля 0…1 в сторону правого варианта. */
function toRight(scale: ScaleRow[], index: number, side: Participant) {
  const row = scale.find((item) => item.index === index);

  return row ? (row[side] - 1) / SCALE_SPAN : null;
}

/** То же, но в сторону левого варианта. */
function toLeft(scale: ScaleRow[], index: number, side: Participant) {
  const right = toRight(scale, index, side);

  return right === null ? null : 1 - right;
}

/** Доля утверждений с нужным вердиктом среди указанных. */
function verdictShare(
  blitz: BlitzRow[],
  side: Participant,
  verdict: Verdict,
  indices?: number[],
) {
  const rows = indices
    ? blitz.filter((row) => indices.includes(row.index))
    : blitz;

  return share(rows.map((row) => (row[side] === verdict ? 1 : 0)));
}

/** Насколько подробно человек писал о партнёре. Сравнивается только внутри пары. */
function verbosity(state: TestState, side: Participant): number | null {
  const ids = ["stranger", "value", "annoy", "change-behavior"];
  const total = ids.reduce(
    (sum, id) => sum + (state.answers[id]?.[side].trim().length ?? 0),
    0,
  );

  return total === 0 ? null : total;
}

/** Признаки одной стороны, из которых собираются все раунды баттла. */
type SideTraits = {
  attachment: number | null;
  control: number;
  strictness: number | null;
  planning: number | null;
  objectivity: number | null;
  intrusive: number | null;
  space: number | null;
  words: number | null;
};

function traitsOf(
  side: Participant,
  state: TestState,
  blitz: BlitzRow[],
  scale: ScaleRow[],
  goals: ChoiceRow[],
  goalOptions: string[],
): SideTraits {
  return {
    // «Жить со мной в бедности» и «10 лет, но со мной» — про привязанность.
    attachment: mixOrNull([
      [toLeft(scale, 0, side), 0.5],
      [toRight(scale, 5, side), 0.5],
    ]),
    control: controlScore(side, blitz, scale),
    // Только запреты партнёру. Считать «стрем» по всему блицу нельзя: там есть
    // утверждение про уклад (8) и про общий быт (9) — от них «душнила» не
    // зависит, а знак у них ещё и обратный.
    strictness: verdictShare(blitz, side, "bad", [0, 2, 3, 7]),
    planning: toRight(scale, 4, side),
    objectivity: toRight(scale, 6, side),
    intrusive: verdictShare(blitz, side, "ok", [1, 4, 5]),
    space: pickedAt(goals, goalOptions, 9),
    words: verbosity(state, side),
  };
}

/** Как mix, но возвращает null, если ни одного сигнала нет. */
function mixOrNull(parts: Array<[number | null, number]>): number | null {
  return parts.every(([value]) => value === null) ? null : mix(parts);
}

/**
 * Ползунок раунда: сравниваем один и тот же признак у обоих.
 * Края оставляем свободными — кружок на самом краю выглядит как сбой.
 */
function slider(she: number | null, he: number | null): number {
  if (she === null || he === null) return 50;

  return Math.round(clamp(50 + (he - she) * 50, 10, 90));
}

/**
 * Две величины в доли одного целого.
 *
 * Нужно для признаков вне диапазона 0…1 — например для длины ответов. Без
 * этого разница подставлялась в slider как есть (300 против 150 знаков → 50 +
 * 150 * 50), и раунд всегда упирался в край шкалы.
 */
function toShares(
  she: number | null,
  he: number | null,
): [number | null, number | null] {
  const total = (she ?? 0) + (he ?? 0);
  if (total === 0) return [null, null];

  return [(she ?? 0) / total, (he ?? 0) / total];
}

function buildBattle(she: SideTraits, he: SideTraits): BattleRound[] {
  const [sheWords, heWords] = toShares(she.words, he.words);

  return [
    { id: "love", value: slider(she.attachment, he.attachment) },
    { id: "boss", value: slider(she.control, he.control) },
    { id: "understand", value: slider(sheWords, heWords) },
    {
      id: "boring",
      value: slider(
        mixOrNull([
          [she.strictness, 0.5],
          [she.planning, 0.5],
        ]),
        mixOrNull([
          [he.strictness, 0.5],
          [he.planning, 0.5],
        ]),
      ),
    },
    {
      id: "toxic",
      value: slider(
        mixOrNull([
          [she.intrusive, 0.5],
          [lack(she.objectivity), 0.5],
        ]),
        mixOrNull([
          [he.intrusive, 0.5],
          [lack(he.objectivity), 0.5],
        ]),
      ),
    },
    { id: "wise", value: slider(she.objectivity, he.objectivity) },
    { id: "manipulator", value: slider(she.intrusive, he.intrusive) },
    {
      id: "codependent",
      value: slider(
        mixOrNull([
          [she.attachment, 0.7],
          [lack(she.space), 0.3],
        ]),
        mixOrNull([
          [he.attachment, 0.7],
          [lack(he.space), 0.3],
        ]),
      ),
    },
  ];
}

/**
 * Сигналы пары, из которых выбираются архетип, супер-сила и зона риска.
 * Все значения 0…1, чтобы веса в правилах читались как проценты.
 */
type Signals = {
  /** Вариант отмечен: оба — 1, один — 0.5, никто — 0. */
  style: (index: number) => number;
  goal: (index: number) => number;
  /** Оба ответили «норм» / «стрем» на утверждение блица. */
  bothOk: (index: number) => number;
  bothBad: (index: number) => number;
  /** Средний крен обоих к левому или правому варианту шкалы. */
  left: (index: number) => number;
  right: (index: number) => number;
  /** Насколько далеко разошлись позиции в конкретной паре шкалы. */
  gap: (index: number) => number;
  /**
   * Общие показатели пары. Нет данных — 0, а не 0.5: правила складывают
   * улику к улике, и «серединка» здесь работала бы как бесплатный балл.
   */
  agreement: number;
  closeness: number;
  clashShare: number;
  /** Обратный clashShare, но только когда шкала пройдена. */
  calm: number;
};

function buildSignals(
  blitz: BlitzRow[],
  scale: ScaleRow[],
  style: ChoiceRow[],
  styleOptions: string[],
  goals: ChoiceRow[],
  goalOptions: string[],
  agreementValue: number | null,
  closenessValue: number | null,
  clashValue: number | null,
): Signals {
  const verdictBoth = (index: number, verdict: Verdict) => {
    const row = blitz.find((item) => item.index === index);
    if (!row) return 0;

    return row.she === verdict && row.he === verdict ? 1 : 0;
  };

  const lean = (index: number, side: "left" | "right") => {
    const row = scale.find((item) => item.index === index);
    if (!row) return 0;

    const toRightShare = (row.she + row.he - 2) / (2 * SCALE_SPAN);

    return side === "right" ? toRightShare : 1 - toRightShare;
  };

  return {
    style: (index) => pickedAt(style, styleOptions, index) ?? 0,
    goal: (index) => pickedAt(goals, goalOptions, index) ?? 0,
    bothOk: (index) => verdictBoth(index, "ok"),
    bothBad: (index) => verdictBoth(index, "bad"),
    left: (index) => lean(index, "left"),
    right: (index) => lean(index, "right"),
    gap: (index) => {
      const row = scale.find((item) => item.index === index);
      return row ? row.distance / SCALE_SPAN : 0;
    },
    agreement: agreementValue ?? 0,
    closeness: closenessValue ?? 0,
    clashShare: clashValue ?? 0,
    calm: clashValue === null ? 0 : 1 - clashValue,
  };
}

/** Правило: сумма взвешенных сигналов. Побеждает метка с наибольшей суммой. */
type Rule<Id extends string> = { id: Id; score: (s: Signals) => number };

/**
 * Знак сигналов важнее веса.
 *
 * «Прокачать» — это список нехваток, а не достоинств: кто отметил «больше
 * юмора», у того юмора сейчас мало. Поэтому пункты level-up идут только в
 * риски и в отрицательные метрики, а супер-силы собираются из описания стиля
 * и из совпавших ответов блица и шкалы.
 */
const ARCHETYPE_RULES: Rule<ArchetypeId>[] = [
  // Стиль отношений весит больше всего: это прямое самоописание пары.
  {
    id: "match-gasoline",
    score: (s) => s.style(0) * 2 + s.style(7) * 0.5 + s.closeness * 0.5,
  },
  { id: "two-worlds", score: (s) => s.style(1) * 2 + s.clashShare * 2 },
  { id: "swing", score: (s) => s.style(10) * 3 },
  { id: "wit-duel", score: (s) => s.style(3) * 2 + s.style(5) * 0.5 },
  { id: "ice-silence", score: (s) => s.bothOk(6) * 2 + s.bothBad(3) },
  {
    // Границы, а не желание границ: «больше личного пространства» означает,
    // что его сейчас нет, и это сигнал ровно противоположного склада пары.
    id: "two-fortresses",
    score: (s) =>
      s.bothOk(2) * 1.5 + s.bothBad(1) + s.bothBad(4) + s.right(6) * 0.5,
  },
  { id: "parallel-lines", score: (s) => s.goal(0) * 2 + s.bothOk(2) * 1.5 },
  {
    id: "quiet-harbor",
    score: (s) => s.style(4) * 2 + s.style(2) + s.left(9),
  },
  {
    id: "dream-team",
    score: (s) => s.style(8) * 2 + s.agreement * 1.5 + s.closeness,
  },
  { id: "soft-mode", score: (s) => s.style(6) * 2 + s.style(2) * 0.5 },
  { id: "living-fire", score: (s) => s.style(7) * 2 + s.left(2) },
  { id: "in-the-spotlight", score: (s) => s.style(9) * 2 + s.right(9) },
];

const POWER_RULES: Rule<PowerId>[] = [
  // «Ничего не менял бы» — единственный пункт level-up, который говорит о
  // достатке, а не о нехватке.
  { id: "routine-immunity", score: (s) => s.style(5) * 2 + s.goal(11) * 0.5 },
  { id: "steady-calm", score: (s) => s.style(4) * 2 + s.calm },
  { id: "humor-armor", score: (s) => s.style(3) * 2 + s.style(5) * 0.5 },
  {
    // Доверие — это все три «не лезем в личное» плюс свобода вокруг пары.
    // Геолокацию (5) добавили, иначе доверие считалось не по тем признакам,
    // по которым потом считается контроль.
    id: "full-trust",
    score: (s) =>
      s.bothBad(1) +
      s.bothBad(4) +
      s.bothBad(5) +
      s.bothOk(0) * 0.5 +
      s.bothOk(2) * 0.5,
  },
  { id: "one-team", score: (s) => s.style(8) * 1.5 + s.agreement * 1.5 },
  // Мирятся до сна и не выносят ссоры наружу — разбираются между собой.
  { id: "straight-talk", score: (s) => s.bothBad(6) * 1.5 + s.bothBad(3) },
  { id: "tender-tongue", score: (s) => s.style(6) * 2 + s.style(2) * 0.5 },
  {
    id: "adventure-drive",
    score: (s) => s.right(9) * 1.5 + s.left(4) + s.style(5) * 0.5,
  },
  { id: "shared-load", score: (s) => s.bothOk(9) * 2 },
  { id: "hot-closeness", score: (s) => s.style(7) * 2 + s.left(2) },
];

const RISK_RULES: Rule<RiskId>[] = [
  { id: "burn-it-down", score: (s) => s.style(0) * 2 + s.clashShare },
  { id: "silent-drift", score: (s) => s.bothOk(6) * 2 + s.style(4) * 0.5 },
  { id: "joke-away", score: (s) => s.style(3) * 1.5 + s.goal(10) * 0.5 },
  {
    id: "control-creep",
    score: (s) =>
      s.bothOk(1) +
      s.bothOk(4) +
      s.bothOk(5) +
      s.bothBad(0) * 0.5 +
      s.goal(6) * 0.5,
  },
  {
    // «Больше личного пространства» — прямая улика растворения, а не её
    // отсутствие: раньше здесь стояло (1 - goal(9)), и непройденный вопрос
    // сам по себе давал риску полбалла.
    id: "dissolve",
    score: (s) => s.left(6) * 1.5 + s.goal(9) * 0.75 + s.left(0) * 0.5,
  },
  {
    id: "words-no-return",
    score: (s) => s.style(0) * 1.5 + s.goal(1) * 0.5 + s.bothBad(6) * 0.5,
  },
  { id: "quiet-grudge", score: (s) => s.bothOk(6) * 1.5 + s.goal(10) * 0.5 },
  {
    id: "escape-talk",
    score: (s) => s.right(9) + s.bothOk(2) + s.left(4) * 0.5,
  },
  { id: "keeping-score", score: (s) => s.bothBad(9) * 2 + s.goal(10) },
  {
    id: "off-rhythm",
    score: (s) => s.gap(2) * 1.5 + s.goal(3) * 0.5 + s.goal(4) * 0.5,
  },
];

/**
 * Победитель среди разрешённых меток. Ничью и полное отсутствие сигналов
 * разруливает хеш ответов — так отчёт остаётся одинаковым при перезагрузке.
 */
function pickBest<Id extends string>(
  rules: Rule<Id>[],
  allowed: readonly Id[],
  signals: Signals,
  state: TestState,
  /** Соль хеша: без неё ничья во всех трёх списках падает на один и тот же номер. */
  salt: string,
): Id {
  const pool = rules.filter((rule) => allowed.includes(rule.id));
  if (pool.length === 0) return allowed[0];

  const scored = pool.map((rule) => ({ id: rule.id, value: rule.score(signals) }));
  const best = Math.max(...scored.map((item) => item.value));

  // Порог отсекает случайный шум: 0.5 — это один вариант, отмеченный одним.
  const winners = scored.filter((item) => item.value === best && best >= 0.5);
  if (winners.length === 0) {
    return pool[hashIndex(state, pool.length, salt)].id;
  }

  return winners[hashIndex(state, winners.length, salt)].id;
}

/** Стабильный номер: одинаковые ответы — одинаковый выбор. */
function hashIndex(state: TestState, length: number, salt: string): number {
  const source =
    salt +
    Object.entries(state.answers)
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

/**
 * Отчёт по ответам пары.
 *
 * `analysis` — уже проверенный разбор нейросети (см. src/lib/ai/analysis.ts).
 * Каждое его значение необязательное: чего модель не прислала или что не прошло
 * проверку, считается формулой. Метки при этом всё равно проходят через
 * матрицу сочетаний, поэтому противоречивая пара «сила + риск» не появится ни
 * от формул, ни от модели.
 */
export function buildReport(
  state: TestState,
  quiz: Quiz,
  analysis?: Analysis | null,
): Report {
  const scaleRows = buildScale(state, quiz);
  const blitz = buildBlitz(state, quiz);
  const style = buildChoices(state, quiz, "relationship-style");
  const goals = buildChoices(state, quiz, "level-up");

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
    goals.length > 0;

  const templateCompatibility = hasData
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

  const compatibility = analysis?.compatibility ?? templateCompatibility;

  // Каждая метрика собирается из своих вопросов: так числа не повторяют
  // друг друга и их можно объяснить пользователю.
  // Доверие — это позиция, а не согласие. Пара, где оба считают нормой читать
  // переписки, идеально согласна друг с другом, но доверия там нет, поэтому
  // главный вес у обратной склонности к контролю.
  const controlAvg = share([
    controlScore("she", blitz, scaleRows),
    controlScore("he", blitz, scaleRows),
  ]);

  const rawMetrics: Record<MetricId, number> = {
    trust: mix([
      [blitz.length === 0 ? null : lack(controlAvg), 0.5],
      [agreement(blitz, [1, 4, 5]), 0.2],
      [lack(pickedAt(goals, goalOptions, 6)), 0.2],
      [allAgreement, 0.1],
    ]),
    values: mix([
      [closeness(scaleRows, [1, 8]), 0.5],
      [agreement(blitz, [8, 9]), 0.3],
      [styleOverlap, 0.2],
    ]),
    humor: mix([
      [pickedAt(style, styleOptions, 3), 0.35],
      [pickedAt(style, styleOptions, 5), 0.3],
      // «Больше лёгкости и юмора» — просьба, а не оценка: знак обратный.
      [lack(pickedAt(goals, goalOptions, 7)), 0.15],
      [allCloseness, 0.2],
    ]),
    sex: mix([
      [closeness(scaleRows, [2]), 0.35],
      [pickedAt(style, styleOptions, 7), 0.35],
      // «Больше страсти» и «больше разнообразия» — тоже про нехватку.
      [lack(pickedAt(goals, goalOptions, 3)), 0.15],
      [lack(pickedAt(goals, goalOptions, 4)), 0.15],
    ]),
    // «Быть собой» — это разрешённая свобода, а не согласие: пара, где оба
    // считают дружбу с другими и отпуск раздельно недопустимыми, согласна
    // полностью, но места для себя там нет.
    self: mix([
      [
        mixOrNull([
          [verdictShare(blitz, "she", "ok", [0, 2, 7]), 0.5],
          [verdictShare(blitz, "he", "ok", [0, 2, 7]), 0.5],
        ]),
        0.5,
      ],
      [closeness(scaleRows, [4, 6]), 0.3],
      [lack(pickedAt(goals, goalOptions, 9)), 0.2],
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

  // Тон считается от итогового числа, поэтому подпись и цвет не могут
  // разойтись с процентом, кто бы этот процент ни назвал.
  const metrics: Metric[] = METRIC_ORDER.map((id) => {
    const value = analysis?.metrics[id] ?? toPercent(rawMetrics[id]);

    return { id, value, tone: toneOf(id, value) };
  });

  // Сначала архетип, потом сила и риск — но только из совместимых с ним.
  const signals = buildSignals(
    blitz,
    scaleRows,
    style,
    styleOptions,
    goals,
    goalOptions,
    allAgreement,
    allCloseness,
    clashShare,
  );

  /*
   * Метки модели держим отдельно от итоговых: её текст к архетипу, силе и риску
   * годится только там, где мы взяли и саму метку. Если метку пришлось
   * пересчитать, текст описывает уже не то, что стоит в отчёте, — тогда в дело
   * идёт описание из словаря.
   */
  const modelArchetype = analysis?.archetype ?? null;

  const archetype =
    modelArchetype ??
    pickBest(ARCHETYPE_RULES, ARCHETYPE_IDS, signals, state, "archetype");

  const match = ARCHETYPE_MATCH[archetype];

  /*
   * Сначала риск, потом сила — и только из тех, что с этим риском не спорят.
   *
   * Порядок именно такой из-за поведения модели: риск она подтверждает
   * ответами («проверяют переписки» → контроль), а силу иногда берёт из списка
   * почти наугад, потому что выбрать надо, а хвалить пару не за что. Поэтому
   * при противоречии сохраняем риск и пересчитываем силу.
   */
  const modelRisk =
    analysis && match.risks.includes(analysis.risk) ? analysis.risk : null;

  const risk =
    modelRisk ?? pickBest(RISK_RULES, match.risks, signals, state, "risk");

  const allowedPowers = powersFor(risk, match.powers);

  const modelPower =
    analysis && allowedPowers.includes(analysis.power) ? analysis.power : null;

  const power =
    modelPower ??
    pickBest(POWER_RULES, allowedPowers, signals, state, "power");

  const matches = [...scaleRows]
    .filter((row) => row.kind !== "clash")
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  const clashes = [...scaleRows]
    .filter((row) => row.kind === "clash")
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 3);

  const templateFight = clamp(
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
  );

  const battle = buildBattle(
    traitsOf("she", state, blitz, scaleRows, goals, goalOptions),
    traitsOf("he", state, blitz, scaleRows, goals, goalOptions),
  ).map((round) => ({
    ...round,
    value: analysis?.battle[round.id] ?? round.value,
  }));

  /*
   * Вероятность измены держится на доверии и на том, сколько накопилось
   * раздражения: уходят не от совпадения ценностей, а от ощущения, что дома
   * ничего не осталось.
   *
   * Диапазон уже, чем у метрик, и намеренно: «84% измены» по опроснику —
   * обещание, которого никакие ответы не выдержат.
   */
  const cheating =
    analysis?.cheating ??
    toPercent(
      mix([
        [1 - rawMetrics.trust, 0.4],
        [1 - rawMetrics.sex, 0.15],
        [rawMetrics.irritation, 0.2],
        [rawMetrics.toxicity, 0.25],
      ]),
      12,
      74,
    );

  return {
    hasData,
    source: analysis ? "ai" : "template",
    summary: analysis?.summary || null,
    abuserNote: analysis?.abuserNote || null,
    portrait: {
      archetype: (modelArchetype && analysis?.archetypeText) || null,
      power: (modelPower && analysis?.powerText) || null,
      risk: (modelRisk && analysis?.riskText) || null,
    },
    names: { she: state.profile.she.name, he: state.profile.he.name },
    since: state.profile.since,
    answered,
    total: quiz.questions.length,
    compatibility,
    compatTone: compatibility >= 70 ? "good" : compatibility >= 50 ? "mid" : "bad",
    archetype,
    power,
    risk,
    metrics,
    abuser: analysis?.abuser ?? abuserVerdict(blitz, scaleRows),
    flags: buildFlags(
      blitz,
      scaleRows,
      style,
      styleOptions,
      goals,
      goalOptions,
    ),
    battle,
    scale: { rows: scaleRows, matches, clashes },
    blitz,
    risks: {
      fight: analysis?.fight ?? templateFight,
      // Считается от итоговой совместимости, поэтому «95% вместе» и «80%
      // расстанемся» рядом не встанут.
      breakup: clamp(105 - compatibility, 15, 80),
    },
    cheating: {
      value: cheating,
      tone: cheating >= 60 ? "bad" : cheating >= 35 ? "mid" : "good",
      note: analysis?.cheatingNote || null,
    },
    dates: analysis?.dates ?? [],
    fun: analysis?.fun ?? null,
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
