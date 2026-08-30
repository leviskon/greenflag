/**
 * Состояние доступа к закрытой части отчёта.
 *
 * Единственное место, где запечатанный пакет превращается обратно в блоки
 * 4–10, и происходит это только когда оплата подтверждена. Отсюда же страница
 * отчёта узнаёт цену, а после возврата с оплаты опрашивает этот маршрут, пока
 * не придёт webhook от Finik.
 *
 * Сервер здесь ничего не помнит про отчёт: пакет приносит сам клиент, а из
 * хранилища берётся только отметка «эта пара оплатила».
 */

import {
  isId,
  REPORT_CURRENCY,
  REPORT_PRICE,
  type AccessPayload,
  type LockedReport,
} from "@/lib/paywall/plan";
import { unseal } from "@/lib/paywall/seal";
import { isPaid, StoreUnavailableError } from "@/lib/paywall/store";

/** Запечатанный отчёт — несколько килобайт; ограничение отсекает мусор. */
const MAX_SEALED = 256 * 1024;

const NO_STORE = { "cache-control": "no-store" };

function answer(payload: AccessPayload, status = 200) {
  // Ответ личный и меняется после оплаты: кешировать его нельзя.
  return Response.json(payload, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    return Response.json({ error: "bad-body" }, { status: 400, headers: NO_STORE });
  }

  const { clientId, sealed } = parsed as {
    clientId?: unknown;
    sealed?: unknown;
  };

  if (!isId(clientId)) {
    return Response.json(
      { error: "bad-client" },
      { status: 400, headers: NO_STORE },
    );
  }

  if (typeof sealed === "string" && sealed.length > MAX_SEALED) {
    return Response.json(
      { error: "too-large" },
      { status: 413, headers: NO_STORE },
    );
  }

  const base = {
    price: REPORT_PRICE,
    currency: REPORT_CURRENCY,
  };

  let paid: boolean;

  try {
    paid = await isPaid(clientId);
  } catch (error) {
    console.error("[paywall] хранилище оплат недоступно", error);

    if (!(error instanceof StoreUnavailableError)) throw error;

    // ok:false — «неизвестно», а не «не оплачено»: иначе оплатившей паре
    // снова показали бы кнопку оплаты.
    return answer({ ...base, ok: false, paid: false, locked: null }, 503);
  }

  if (!paid) {
    return answer({ ...base, ok: true, paid: false, locked: null });
  }

  // Пакет распечатывается только под тот clientId, для которого собран.
  const locked = unseal(sealed, clientId) as LockedReport | null;

  if (!locked) {
    // Оплата есть, а пакета нет: он не сохранился, испорчен или собран другим
    // ключом. Страница отчёта покажет «отчёт устарел», а не кнопку оплаты.
    console.warn(`[paywall] нечего распечатать для ${clientId}`);
  }

  return answer({ ...base, ok: true, paid: true, locked });
}
