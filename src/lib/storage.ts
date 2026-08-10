/** Локальное хранение прохождения теста. Работает только в браузере. */

import { isLocale, type Locale } from "@/lib/i18n/config";

export const STORAGE_KEY = "greenflag.test.v3";

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

export function isAnswered(state: TestState, questionId: string): boolean {
  const pair = state.answers[questionId];
  return Boolean(pair?.she.trim() && pair?.he.trim());
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
    const parsed: unknown = JSON.parse(raw);
    return isState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Снимок для клиента: строка JSON или "" если данных нет. */
export function readRawState(): string {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
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

  try {
    const serialized = JSON.stringify({ ...state, updatedAt: new Date().toISOString() });
    window.localStorage.setItem(STORAGE_KEY, serialized);
    window.dispatchEvent(new Event("greenflag:test-state"));
    return true;
  } catch (error) {
    console.error("Failed to save state to localStorage:", error);
    return false;
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Удалять нечего.
  }

  window.dispatchEvent(new Event("greenflag:test-state"));
}
