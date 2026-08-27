/** Клиентская обёртка над /api/report. Ключа здесь нет и быть не может. */

import { guardAnalysis, type Analysis } from "./analysis";
import type { TestState } from "@/lib/storage";

type ApiResponse = { ok?: boolean; analysis?: unknown; reason?: string };

/**
 * Разбор пары от нейросети. null — не получилось: отчёт в этом случае
 * собирается по формулам, поэтому вызывающему не нужно ничего обрабатывать.
 *
 * Причину не показываем пользователю, но пишем в консоль: на этапе отладки
 * важно видеть, это лимит, таймаут или сломанный JSON.
 */
/**
 * Что уходит на сервер: имена, дата начала отношений и ответы.
 *
 * Почта и даты рождения для разбора не нужны, поэтому не покидают устройство —
 * так в запросе нет ни одного поля, которое модель всё равно не читает.
 */
function forRequest(state: TestState): TestState {
  return {
    ...state,
    profile: {
      she: { name: state.profile.she.name, birthday: "" },
      he: { name: state.profile.he.name, birthday: "" },
      since: state.profile.since,
      email: "",
    },
  };
}

export async function fetchAnalysis(state: TestState): Promise<Analysis | null> {
  try {
    const response = await fetch("/api/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: forRequest(state) }),
    });

    const data = (await response.json()) as ApiResponse;

    if (!data.ok) {
      console.warn(`[report] ai skipped: ${data.reason ?? response.status}`);

      return null;
    }

    return guardAnalysis(data.analysis);
  } catch (error) {
    console.warn("[report] ai request failed", error);

    return null;
  }
}
