/**
 * Структура контента: только числа, состояния и порядок блоков.
 * Все тексты живут в словарях (src/lib/i18n).
 */

export const COMPATIBILITY = 60;

export const HERO_FACTS = ["minutes", "insights", "models"] as const;

/**
 * Пример метрик на лендинге. Тон обязан считаться по тем же порогам, что и в
 * отчёте (см. toneOf в src/lib/report.ts): у «раздражения» и «токсичности»
 * меньше — лучше, поэтому 42% и 31% там не красные.
 */
export const ANATOMY_METRICS = [
  { id: "trust", value: 84, tone: "good" },
  { id: "values", value: 78, tone: "good" },
  { id: "humor", value: 91, tone: "good" },
  { id: "sex", value: 73, tone: "good" },
  { id: "self", value: 69, tone: "mid" },
  { id: "irritation", value: 42, tone: "mid" },
  { id: "toxicity", value: 31, tone: "good" },
] as const;

export const FLAG_STATS = [
  { id: "she", green: 12, red: 4 },
  { id: "he", green: 9, red: 7 },
] as const;

export const RISKS = [
  { id: "fight", value: "72%" },
  { id: "breakup", value: "61%" },
] as const;

export const REPORT_BLOCK_IDS = [
  "portrait",
  "flagmeter",
  "abuser",
  "battle",
  "breakup",
  "forecast",
  "strengths",
  "cheating",
  "irritation",
  "love",
  "dates",
  "fun",
] as const;

export const BATTLE_ROUNDS = [
  { id: "love", winner: "she" },
  { id: "boss", winner: "he" },
  { id: "understand", winner: "she" },
  { id: "boring", winner: "he" },
  { id: "toxic", winner: "locked" },
  { id: "manipulator", winner: "locked" },
] as const;

export const TRIALS = [
  { id: "island", state: "open" },
  { id: "money", state: "locked" },
  { id: "child", state: "locked" },
  { id: "routine", state: "locked" },
  { id: "distance", state: "locked" },
  { id: "move", state: "locked" },
  { id: "passion", state: "locked" },
] as const;

export const AI_MODELS = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "Grok",
  "DeepSeek",
  "Perplexity",
] as const;

export const NAV_KEYS = [
  { id: "how", href: "#how" },
  { id: "report", href: "#report" },
  { id: "trials", href: "#trials" },
  { id: "faq", href: "#faq" },
] as const;

/**
 * Архетип пары, супер-сила и зона риска.
 *
 * Метки фиксированные: у каждой своя картинка и свой текст в словаре. Правила
 * выбора живут в src/lib/report.ts — пока это формулы по ответам, позже метку
 * будет выбирать ИИ из этих же списков.
 */
export const ARCHETYPE_IDS = [
  "match-gasoline",
  "two-worlds",
  "swing",
  "wit-duel",
  "ice-silence",
  "two-fortresses",
  "parallel-lines",
  "quiet-harbor",
  "dream-team",
  "soft-mode",
  "living-fire",
  "in-the-spotlight",
] as const;

/**
 * Сила и её тень: одно качество при мере и при перегибе.
 *
 * Раньше пары держались на порядке двух отдельных списков и на комментарии
 * «совпадают по номерам». Любая правка списка молча ломала пару, поэтому
 * связь теперь записана явно, а списки выводятся из неё.
 */
export const POWER_SHADOW = {
  "routine-immunity": "burn-it-down",
  "steady-calm": "silent-drift",
  "humor-armor": "joke-away",
  "full-trust": "control-creep",
  "one-team": "dissolve",
  "straight-talk": "words-no-return",
  "tender-tongue": "quiet-grudge",
  "adventure-drive": "escape-talk",
  "shared-load": "keeping-score",
  "hot-closeness": "off-rhythm",
} as const;

export type ArchetypeId = (typeof ARCHETYPE_IDS)[number];
export type PowerId = keyof typeof POWER_SHADOW;
export type RiskId = (typeof POWER_SHADOW)[PowerId];

export const POWER_IDS = Object.keys(POWER_SHADOW) as readonly PowerId[];
export const RISK_IDS = Object.values(POWER_SHADOW) as readonly RiskId[];

/** Картинки архетипов лежат в /public/archetypes и названы по порядку списка. */
export const ARCHETYPE_ART: Record<ArchetypeId, string> = {
  "match-gasoline": "/archetypes/a1.jpg",
  "two-worlds": "/archetypes/a2.jpg",
  swing: "/archetypes/a3.jpg",
  "wit-duel": "/archetypes/a4.jpg",
  "ice-silence": "/archetypes/a5.jpg",
  "two-fortresses": "/archetypes/a6.jpg",
  "parallel-lines": "/archetypes/a7.jpg",
  "quiet-harbor": "/archetypes/a8.jpg",
  "dream-team": "/archetypes/a9.jpg",
  "soft-mode": "/archetypes/a10.jpg",
  "living-fire": "/archetypes/a11.jpg",
  "in-the-spotlight": "/archetypes/a12.jpg",
};

/**
 * Картинки сил и рисков: /public/super и /public/risks, тоже по порядку
 * списков. Карты полные, а не частичные, — тогда забытая метка становится
 * ошибкой типов, а не пустым градиентом на слайде.
 */
export const POWER_ART: Record<PowerId, string> = {
  "routine-immunity": "/super/s1.jpg",
  "steady-calm": "/super/s2.jpg",
  "humor-armor": "/super/s3.jpg",
  "full-trust": "/super/s4.jpg",
  "one-team": "/super/s5.jpg",
  "straight-talk": "/super/s6.jpg",
  "tender-tongue": "/super/s7.jpg",
  "adventure-drive": "/super/s8.jpg",
  "shared-load": "/super/s9.jpg",
  "hot-closeness": "/super/s10.jpg",
};

export const RISK_ART: Record<RiskId, string> = {
  "burn-it-down": "/risks/r1.jpg",
  "silent-drift": "/risks/r2.jpg",
  "joke-away": "/risks/r3.jpg",
  "control-creep": "/risks/r4.jpg",
  dissolve: "/risks/r5.jpg",
  "words-no-return": "/risks/r6.jpg",
  "quiet-grudge": "/risks/r7.jpg",
  "escape-talk": "/risks/r8.jpg",
  "keeping-score": "/risks/r9.jpg",
  "off-rhythm": "/risks/r10.jpg",
};

/**
 * Сила и риск, которые нельзя показать вместе.
 *
 * Матрица архетипа отсекает только грубые несовпадения по типу пары, но силу
 * и риск мы выбираем независимо, поэтому внутри одного архетипа всё равно
 * могла собраться взаимоисключающая пара слайдов: «Полное доверие: телефоны не
 * проверяете» рядом с «Контроль вместо доверия: пароли, геолокация».
 *
 * Тень из POWER_SHADOW в списке не запрещена — это то же качество при
 * перегибе, и вместе они читаются как «сейчас работает, но легко перегнуть».
 * Исключение — «Полное доверие» и «Горячая близость»: их тени описывают не
 * перегиб, а нехватку того же качества, поэтому запрещены.
 */
export const POWER_RISK_CONFLICTS: Record<PowerId, readonly RiskId[]> = {
  // «Высказали, обнулились» не сочетается с копящимся молчанием.
  "routine-immunity": ["silent-drift", "quiet-grudge"],
  // «Без крика и драм» не сочетается со срывом тормозов.
  "steady-calm": ["burn-it-down", "words-no-return"],
  "humor-armor": [],
  "full-trust": ["control-creep"],
  // «Проблема общая, а не твоя» не сочетается с подсчётом вклада.
  "one-team": ["keeping-score"],
  // Прямой разговор не сочетается ни с одной формой «не поговорить».
  "straight-talk": ["silent-drift", "quiet-grudge", "joke-away", "escape-talk"],
  "tender-tongue": [],
  "adventure-drive": [],
  "shared-load": [],
  "hot-closeness": ["off-rhythm"],
};

/** Риски архетипа, совместимые с выбранной силой. Пусто не бывает. */
export function risksFor(
  power: PowerId,
  risks: readonly RiskId[],
): readonly RiskId[] {
  const banned = POWER_RISK_CONFLICTS[power];
  const allowed = risks.filter((risk) => !banned.includes(risk));

  return allowed.length > 0 ? allowed : risks;
}

/** То же в обратную сторону: силы, совместимые с выбранным риском. */
export function powersFor(
  risk: RiskId,
  powers: readonly PowerId[],
): readonly PowerId[] {
  const allowed = powers.filter(
    (power) => !POWER_RISK_CONFLICTS[power].includes(risk),
  );

  return allowed.length > 0 ? allowed : powers;
}

/**
 * Что с чем сочетается. Без этого выпадают противоречия вроде
 * «Железное спокойствие» + «Сжечь всё дотла».
 */
export const ARCHETYPE_MATCH: Record<
  ArchetypeId,
  { powers: readonly PowerId[]; risks: readonly RiskId[] }
> = {
  "match-gasoline": {
    powers: ["routine-immunity", "straight-talk", "hot-closeness"],
    risks: ["burn-it-down", "words-no-return"],
  },
  "two-worlds": {
    powers: ["straight-talk", "adventure-drive", "humor-armor"],
    risks: ["words-no-return", "keeping-score", "silent-drift", "off-rhythm"],
  },
  swing: {
    powers: ["routine-immunity", "hot-closeness", "full-trust"],
    risks: ["burn-it-down", "control-creep", "silent-drift", "off-rhythm"],
  },
  "wit-duel": {
    powers: ["humor-armor", "routine-immunity", "straight-talk"],
    risks: ["joke-away", "words-no-return"],
  },
  "ice-silence": {
    powers: ["steady-calm", "shared-load"],
    risks: ["silent-drift", "quiet-grudge"],
  },
  "two-fortresses": {
    powers: ["steady-calm", "straight-talk", "shared-load"],
    risks: ["silent-drift", "control-creep", "keeping-score"],
  },
  "parallel-lines": {
    powers: ["steady-calm", "adventure-drive", "shared-load"],
    risks: ["silent-drift", "escape-talk", "keeping-score"],
  },
  "quiet-harbor": {
    powers: ["steady-calm", "tender-tongue", "shared-load"],
    risks: ["silent-drift", "quiet-grudge"],
  },
  "dream-team": {
    powers: ["one-team", "shared-load", "straight-talk"],
    risks: ["dissolve", "keeping-score"],
  },
  "soft-mode": {
    powers: ["tender-tongue", "full-trust", "hot-closeness"],
    risks: ["quiet-grudge", "dissolve"],
  },
  "living-fire": {
    powers: ["hot-closeness", "routine-immunity", "full-trust"],
    risks: ["off-rhythm", "burn-it-down"],
  },
  "in-the-spotlight": {
    powers: ["adventure-drive", "humor-armor", "one-team"],
    risks: ["escape-talk", "joke-away", "dissolve"],
  },
};
