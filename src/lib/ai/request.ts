/** Клиентская обёртка над /api/report. Ключа здесь нет и быть не может. */

import { guardAnalysis, type Analysis } from "./analysis";
import { normalizeAccess, DEFAULT_ACCESS } from "@/lib/paywall/client";
import type { AccessPayload } from "@/lib/paywall/plan";
import { readClientId, type TestState } from "@/lib/storage";

type ApiResponse = {
  ok?: boolean;
  analysis?: unknown;
  reportId?: unknown;
  sealed?: unknown;
  reason?: string;
  access?: unknown;
};

export type ReportResult = {
  /**
   * Разбор нейросети без закрытой части: блоки 4–10 приходят отдельно и
   * запечатанными. null — разбора нет вообще, отчёт соберётся по формулам.
   */
  analysis: Analysis | null;
  /** Номер отчёта: нужен платежу и логам. */
  reportId: string | null;
  /** Закрытая часть в запечатанном виде: открывает её только сервер. */
  sealed: string | null;
  access: AccessPayload;
};

const EMPTY: ReportResult = {
  analysis: null,
  reportId: null,
  sealed: null,
  access: DEFAULT_ACCESS,
};

/**
 * Что уходит на сервер: имена, дата начала отношений и ответы.
 *
 * Даты рождения для разбора не нужны, поэтому не покидают устройство — так в
 * запросе нет ни одного поля, которое модель всё равно не читает.
 */
function forRequest(state: TestState): TestState {
  return {
    ...state,
    profile: {
      she: { name: state.profile.she.name, birthday: "" },
      he: { name: state.profile.he.name, birthday: "" },
      since: state.profile.since,
    },
  };
}

/**
 * Разбор пары от нейросети и состояние платного доступа.
 *
 * Пустой результат — не ошибка для вызывающего: отчёт в этом случае собирается
 * по формулам. Причину не показываем пользователю, но пишем в консоль: на
 * этапе отладки важно видеть, это лимит, таймаут или сломанный JSON.
 */
export async function fetchAnalysis(state: TestState): Promise<ReportResult> {
  try {
    const response = await fetch("/api/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        state: forRequest(state),
        clientId: readClientId(),
      }),
    });

    const data = (await response.json()) as ApiResponse;

    if (!data.ok) {
      console.warn(`[report] ai skipped: ${data.reason ?? response.status}`);

      return EMPTY;
    }

    if (data.reason) console.warn(`[report] ai skipped: ${data.reason}`);

    return {
      analysis: guardAnalysis(data.analysis),
      reportId: typeof data.reportId === "string" ? data.reportId : null,
      sealed: typeof data.sealed === "string" ? data.sealed : null,
      access: normalizeAccess(data.access),
    };
  } catch (error) {
    console.warn("[report] ai request failed", error);

    return EMPTY;
  }
}
