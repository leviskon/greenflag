/**
 * Создание платежа в Finik.
 *
 * Клиент присылает только «кто» и «за какой отчёт». Сумму, назначение платежа
 * и адреса возврата ставит сервер: цену из окружения подменить из браузера
 * нельзя, иначе полный отчёт можно было бы купить за сом.
 */

import { createFinikPayment, finikConfigError } from "@/lib/finik";
import { isId, REPORT_PRICE } from "@/lib/paywall/plan";
import { isReachable, redirectUrl, webhookUrl } from "@/lib/paywall/urls";
import {
  isPaid,
  rememberPayment,
  storeKind,
  StoreUnavailableError,
} from "@/lib/paywall/store";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";

/** Тот же лимит по частоте, что и у отчёта: маршрут открытый. */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 20;

const hits = new Map<string, number[]>();

function tooManyRequests(ip: string): boolean {
  const now = Date.now();
  const fresh = (hits.get(ip) ?? []).filter((time) => now - time < RATE_WINDOW_MS);

  fresh.push(now);
  hits.set(ip, fresh);

  if (hits.size > 500) {
    for (const [key, times] of hits) {
      if (times.every((time) => now - time >= RATE_WINDOW_MS)) hits.delete(key);
    }
  }

  return fresh.length > RATE_LIMIT;
}

function fail(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (tooManyRequests(ip)) return fail("rate-limit", 429);

  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    return fail("bad-body", 400);
  }

  const { reportId, clientId, locale } = parsed as {
    reportId?: unknown;
    clientId?: unknown;
    locale?: unknown;
  };

  if (!isId(clientId) || !isId(reportId)) return fail("bad-request", 400);
  if (typeof locale !== "string" || !isLocale(locale)) {
    return fail("bad-locale", 400);
  }

  const problem = finikConfigError();
  if (problem) {
    console.error(`[finik] оплата не настроена: ${problem}`);

    return fail("not-configured", 503);
  }

  // Уже оплачено — платёж не создаём, просто говорим клиенту перечитать доступ.
  try {
    if (await isPaid(clientId)) {
      return Response.json({ ok: true, paid: true, paymentUrl: null });
    }
  } catch (error) {
    console.error("[finik] хранилище оплат недоступно", error);

    if (!(error instanceof StoreUnavailableError)) throw error;

    // Брать деньги, когда отметить оплату будет некуда, нельзя.
    return fail("store-unavailable", 503);
  }

  const dict = await getDictionary(locale);
  const webhook = webhookUrl(request);

  // Локальный адрес Finik недоступен: без публичного домена подтверждение
  // оплаты не придёт, и доступ так и не откроется. Лучше сказать сразу в лог,
  // чем ловить это как «оплатил, а ничего не открылось».
  if (!isReachable(webhook)) {
    console.warn(
      `[finik] webhook ${webhook} недоступен из интернета: подтверждение оплаты не дойдёт. Нужен https-домен или туннель (ngrok).`,
    );
  }

  try {
    const { paymentId, paymentUrl } = await createFinikPayment({
      amount: REPORT_PRICE,
      clientId,
      reportId,
      description: dict.reportPage.paywall.paymentDescription,
      redirectUrl: redirectUrl(request, locale),
      webhookUrl: webhook,
    });

    // Запас на случай, если в webhook не дойдут metadata: по PaymentId
    // владельца всё равно можно найти.
    try {
      await rememberPayment(paymentId, clientId);
    } catch (error) {
      // Не критично: основной путь — metadata в самом webhook.
      console.error("[finik] не удалось запомнить платёж", error);
    }

    console.info(
      `[finik] платёж создан: ${paymentId} | отчёт ${reportId} | ${REPORT_PRICE} KGS | хранилище ${storeKind()}`,
    );

    return Response.json({ ok: true, paid: false, paymentUrl });
  } catch (error) {
    console.error("[finik] не удалось создать платёж", error);

    return fail("create-failed", 502);
  }
}
