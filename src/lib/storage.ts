/** Локальное хранение прохождения теста. Работает только в браузере. */

import { isLocale, type Locale } from "@/lib/i18n/config";

export const STORAGE_KEY = "greenflag.test.v3";

/** Черновик первой формы: пишется на каждый ввод, до начала теста. */
export const DRAFT_KEY = "greenflag.profile-draft.v1";

/** Событие для useSyncExternalStore: localStorage сам о записи не сообщает. */
const CHANGE_EVENT = "greenflag:test-state";

export type Participant = "she" | "he";

export type PersonProfile = {
  name: string;
  birthday: string;
};

export type CoupleProfile = {
  she: PersonProfile;
  he: PersonProfile;
  since: string;
  email: string;
};

/** Пара ответов на один вопрос. */
export type AnswerPair = Record<Participant, string>;

/** Ответ хранится вместе с текстом вопроса — так его потом читает ИИ. */
export type StoredAnswer = AnswerPair & {
  question: string;
};

/** questionId -> вопрос и ответы пары */
export type Answers = Record<string, StoredAnswer>;

export type TestState = {
  /** Язык прохождения. Фиксируется на первом шаге и дальше не меняется. */
  locale: Locale;
  profile: CoupleProfile;
  answers: Answers;
  createdAt: string;
  updatedAt: string;
};

export const EMPTY_PROFILE: CoupleProfile = {
  she: { name: "", birthday: "" },
  he: { name: "", birthday: "" },
  since: "",
  email: "",
};

export function createState(
  profile: CoupleProfile,
  locale: Locale,
): TestState {
  const now = new Date().toISOString();

  return {
    locale,
    profile,
    answers: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function withProfile(
  state: TestState,
  profile: CoupleProfile,
): TestState {
  return { ...state, profile, updatedAt: new Date().toISOString() };
}

export function withAnswer(
  state: TestState,
  questionId: string,
  question: string,
  answer: AnswerPair,
): TestState {
  return {
    ...state,
    answers: {
      ...state.answers,
      [questionId]: { question, she: answer.she, he: answer.he },
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Ответ засчитан, только если заполнены обе стороны.
 *
 * У шкалы «или — или» ответ хранится как список значений через запятую — по
 * одному на пару вариантов. Такой ответ бывает заполнен наполовину, поэтому
 * через `slots` передаётся ожидаемое число значений: иначе недозаполненный
 * вопрос считался бы пройденным и тест бы его пролистывал.
 */
export function isAnswered(
  state: TestState,
  questionId: string,
  slots = 1,
): boolean {
  const pair = state.answers[questionId];
  if (!pair) return false;

  return isFilled(pair.she, slots) && isFilled(pair.he, slots);
}

function isFilled(value: string, slots: number): boolean {
  if (slots <= 1) return value.trim() !== "";

  const parts = value.split(",");

  return parts.length === slots && parts.every((part) => part.trim() !== "");
}

/** Готовый к отправке в ИИ вид: порядок вопросов и подписанные ответы. */
export function buildAiPayload(
  state: TestState,
  order: readonly { id: string }[],
) {
  return {
    language: state.locale,
    couple: {
      she: state.profile.she,
      he: state.profile.he,
      relationshipSince: state.profile.since,
      email: state.profile.email,
    },
    startedAt: state.createdAt,
    updatedAt: state.updatedAt,
    answers: order.map((q) => {
      const stored = state.answers[q.id];

      return {
        id: q.id,
        question: stored?.question ?? "",
        she: stored?.she ?? "",
        he: stored?.he ?? "",
      };
    }),
  };
}

function isProfile(value: unknown): value is CoupleProfile {
  if (typeof value !== "object" || value === null) return false;

  const profile = value as Partial<CoupleProfile>;

  return (
    typeof profile.since === "string" &&
    typeof profile.email === "string" &&
    typeof profile.she?.name === "string" &&
    typeof profile.she?.birthday === "string" &&
    typeof profile.he?.name === "string" &&
    typeof profile.he?.birthday === "string"
  );
}

/**
 * Незаконченная форма пары. Нужна, чтобы обновление страницы (или её
 * перезагрузка браузером на телефоне) не обнуляло уже введённые данные.
 */
export function readProfileDraft(): CoupleProfile | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    return isProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveProfileDraft(profile: CoupleProfile): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(profile));
  } catch {
    // Хранилище недоступно (приватный режим) — форма всё равно работает.
  }
}

export function clearProfileDraft(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Удалять нечего.
  }
}

function isState(value: unknown): value is TestState {
  if (typeof value !== "object" || value === null) return false;

  const state = value as Partial<TestState>;
  const profile = state.profile;

  return (
    typeof state.locale === "string" &&
    isLocale(state.locale) &&
    typeof profile === "object" &&
    profile !== null &&
    typeof profile.email === "string" &&
    typeof profile.she?.name === "string" &&
    typeof profile.he?.name === "string" &&
    typeof state.answers === "object" &&
    state.answers !== null
  );
}

/** Разбор снимка из localStorage. Пустая строка означает «данных нет». */
export function parseState(raw: string | null): TestState | null {
  if (!raw) return null;

  try {
    return parseStateValue(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Та же проверка, но для уже разобранного значения: этим пользуется
 * серверный маршрут, которому состояние приходит телом запроса.
 */
export function parseStateValue(value: unknown): TestState | null {
  return isState(value) ? value : null;
}

/**
 * Резерв на случай, когда localStorage недоступен (приватный режим, запрет
 * хранилища): тест хотя бы доходит до конца в рамках одной вкладки.
 */
let memorySnapshot = "";

/** Снимок для клиента: строка JSON или "" если данных нет. */
export function readRawState(): string {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memorySnapshot;
  } catch {
    return memorySnapshot;
  }
}

/** Снимок для сервера и гидрации: должен совпадать с клиентским значением. */
export function readServerState(): string {
  // Всегда возвращаем пустую строку на сервере
  return "";
}

export function subscribeToState(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function saveState(state: TestState): boolean {
  if (typeof window === "undefined") return false;

  const serialized = JSON.stringify({
    ...state,
    updatedAt: new Date().toISOString(),
  });

  memorySnapshot = serialized;
  let saved = true;

  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    saved = false;
    console.error("Failed to save state to localStorage:", error);
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));

  return saved;
}

export function clearState(): void {
  if (typeof window === "undefined") return;

  memorySnapshot = "";
  analysisSnapshot = "";

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(ANALYSIS_KEY);
  } catch {
    // Удалять нечего.
  }

  clearProfileDraft();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/* ─── Разбор нейросети ─────────────────────────────────────────────────── */

export const ANALYSIS_KEY = "greenflag.analysis.v2";

let analysisSnapshot = "";

/**
 * Подпись ответов.
 *
 * Разбор относится к конкретным ответам. Если пара вернулась и что-то
 * поменяла, старый разбор показывать нельзя: числа перестанут сходиться с
 * таблицами, которые считаются на месте. Проще всего это поймать подписью.
 */
export function answersSignature(state: TestState): string {
  const source = Object.entries(state.answers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, answer]) => `${id}:${answer.she}|${answer.he}`)
    .join("~");

  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function saveAnalysis(state: TestState, analysis: unknown): void {
  if (typeof window === "undefined") return;

  const serialized = JSON.stringify({
    signature: answersSignature(state),
    analysis,
  });

  analysisSnapshot = serialized;

  try {
    window.localStorage.setItem(ANALYSIS_KEY, serialized);
  } catch {
    // Не сохранился — отчёт соберётся по формулам.
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Снимок разбора для useSyncExternalStore. */
export function readRawAnalysis(): string {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(ANALYSIS_KEY) ?? analysisSnapshot;
  } catch {
    return analysisSnapshot;
  }
}

/** Разбор, если он относится именно к этим ответам. Иначе null. */
export function readAnalysisFor(
  raw: string | null,
  state: TestState | null,
): unknown {
  if (!raw || !state) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const stored = parsed as { signature?: unknown; analysis?: unknown };

    return stored.signature === answersSignature(state) ? stored.analysis : null;
  } catch {
    return null;
  }
}
