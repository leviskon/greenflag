/**
 * Обёртки над платными маршрутами. Работают только в браузере.
 *
 * Ни один ответ здесь не влияет на то, что видно в отчёте, «по доверию»:
 * закрытые блоки рисуются исключительно из `locked`, который приходит с
 * сервера. Подмена `paid` в devtools ничего не откроет — данных всё равно нет.
 */

import { readClientId } from "@/lib/storage";
import type { AccessPayload, LockedReport } from "./plan";
import { REPORT_CURRENCY, REPORT_PRICE } from "./plan";

/** Пока сервер не ответил, показываем цену из сборки — она оттуда же. */
export const DEFAULT_ACCESS: AccessPayload = {
  ok: true,
  paid: false,
  price: REPORT_PRICE,
  currency: REPORT_CURRENCY,
  locked: null,
};

/** Сервер не отозвался: «не оплачено» здесь означает «неизвестно». */
const UNKNOWN_ACCESS: AccessPayload = { ...DEFAULT_ACCESS, ok: false };

function isLocked(value: unknown): value is LockedReport {
  if (typeof value !== "object" || value === null) return false;

  const locked = value as Partial<LockedReport>;

  return (
    typeof locked.abuser === "string" &&
    Array.isArray(locked.battle) &&
    typeof locked.flags === "object" &&
    locked.flags !== null &&
    typeof locked.risks === "object" &&
    locked.risks !== null &&
    typeof locked.cheating === "object" &&
    locked.cheating !== null
  );
}

/** Приводим ответ сервера к нашему типу: битому ответу верить нельзя. */
export function normalizeAccess(value: unknown): AccessPayload {
  if (typeof value !== "object" || value === null) return DEFAULT_ACCESS;

  const source = value as Partial<AccessPayload>;
  const price =
    typeof source.price === "number" && source.price > 0
      ? Math.round(source.price)
      : REPORT_PRICE;

  const locked = isLocked(source.locked) ? source.locked : null;

  return {
    ok: source.ok !== false,
    /**
     * `paid` — только сообщение о состоянии оплаты; открывает блоки не он, а
     * наличие `locked`. Поэтому подмена флага в devtools ничего не даёт, зато
     * различимы «не оплачено» и «оплачено, но пакет уже не открывается».
     */
    paid: source.paid === true,
    price,
    currency:
      typeof source.currency === "string" ? source.currency : REPORT_CURRENCY,
    locked,
  };
}

/**
 * Состояние доступа к закрытой части отчёта.
 *
 * `sealed` — запечатанный пакет из localStorage. Сервер его расшифрует, если
 * оплата подтверждена; сам браузер сделать этого не может.
 */
export async function fetchAccess(
  sealed: string | null,
): Promise<AccessPayload> {
  try {
    const response = await fetch("/api/report/access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ sealed, clientId: readClientId() }),
    });

    const payload = normalizeAccess(await response.json());

    return response.ok ? payload : { ...payload, ok: false };
  } catch (error) {
    console.warn("[paywall] не удалось проверить доступ", error);

    return UNKNOWN_ACCESS;
  }
}

export type PaymentStart =
  /** Готов адрес платёжной страницы Finik — туда и уводим. */
  | { kind: "redirect"; url: string }
  /** Оплата уже была: доступ можно перечитать. */
  | { kind: "paid" }
  | { kind: "error"; reason: string };

/** Создаёт платёж на сервере и возвращает, куда идти дальше. */
export async function startPayment(
  reportId: string,
  locale: string,
): Promise<PaymentStart> {
  try {
    const response = await fetch("/api/finik/create-payment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reportId, clientId: readClientId(), locale }),
    });

    const data = (await response.json()) as {
      ok?: boolean;
      paid?: boolean;
      paymentUrl?: string | null;
      error?: string;
      detail?: string;
    };

    if (!response.ok || !data.ok) {
      // Причину пишем в консоль целиком: пользователю она ни о чём не говорит,
      // а без неё отладка сводится к чтению логов хостинга.
      console.warn(
        `[paywall] оплата не началась: ${data.error ?? response.status}${data.detail ? ` — ${data.detail}` : ""}`,
      );

      return { kind: "error", reason: data.error ?? String(response.status) };
    }

    if (data.paid) return { kind: "paid" };

    if (typeof data.paymentUrl === "string" && data.paymentUrl) {
      return { kind: "redirect", url: data.paymentUrl };
    }

    return { kind: "error", reason: "no-url" };
  } catch (error) {
    console.warn("[paywall] не удалось начать оплату", error);

    return { kind: "error", reason: "network" };
  }
}
