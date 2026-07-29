/**
 * Структура контента: только числа, состояния и порядок блоков.
 * Все тексты живут в словарях (src/lib/i18n).
 */

export const COMPATIBILITY = 60;

export const HERO_FACTS = ["minutes", "insights", "models"] as const;

export const ANATOMY_METRICS = [
  { id: "trust", value: 84, tone: "good" },
  { id: "values", value: 78, tone: "good" },
  { id: "humor", value: 91, tone: "good" },
  { id: "sex", value: 73, tone: "good" },
  { id: "self", value: 69, tone: "mid" },
  { id: "irritation", value: 42, tone: "bad" },
  { id: "toxicity", value: 31, tone: "bad" },
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
