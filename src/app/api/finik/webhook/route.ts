/**
 * Подтверждение оплаты от Finik.
 *
 * Единственное место, где открывается доступ к закрытой части отчёта. Именно
 * поэтому здесь всё проверяется: подпись запроса публичным ключом Finik,
 * свежесть timestamp (защита от повторной отправки старого уведомления) и
 * повторы (Finik присылает webhook заново, если ответ не дошёл).
 *
 * На обработанное уведомление отвечаем 200, чтобы Finik не повторял. А вот при
 * сбое хранилища — 500: повтор здесь нужен, иначе оплата останется без доступа.
 */

import {
  isSucceeded,
  isTimestampValid,
  readMetadata,
  verifyFinikWebhook,
  type FinikWebhookBody,
} from "@/lib/finik";
import { WEBHOOK_PATH } from "@/lib/paywall/urls";
import {
  clientOfPayment,
  isHandled,
  markHandled,
  markPaid,
  storeKind,
} from "@/lib/paywall/store";

/** Тело webhook небольшое: ограничение отсекает мусор. */
const MAX_BODY = 32 * 1024;

/** Идентификатор платежа: сначала из metadata, потом из полей уведомления. */
function paymentIdOf(body: FinikWebhookBody): string | null {
  const fields = body.fields ?? {};

  for (const value of [fields.paymentId, fields.qrTransactionId]) {
    if (typeof value === "string" && value) return value;
  }

  return null;
}

export async function POST(request: Request) {
  const signature = request.headers.get("signature");
  const timestamp = request.headers.get("x-api-timestamp");

  if (!signature || !timestamp) {
    console.error("[finik] webhook без подписи или timestamp");

    return Response.json({ error: "missing-signature" }, { status: 400 });
  }

  if (!isTimestampValid(timestamp)) {
    console.error(`[finik] webhook с несвежим timestamp: ${timestamp}`);

    return Response.json({ error: "stale-timestamp" }, { status: 400 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) {
    return Response.json({ error: "too-large" }, { status: 413 });
  }

  let body: FinikWebhookBody;
  try {
    body = JSON.parse(raw) as FinikWebhookBody;
  } catch {
    return Response.json({ error: "bad-body" }, { status: 400 });
  }

  // В подписи участвуют Host и путь. За прокси они приходят по-разному,
  // поэтому проверяем все разумные варианты.
  const valid = await verifyFinikWebhook({
    signature,
    timestamp,
    body: body as unknown as Record<string, unknown>,
    hosts: [
      request.headers.get("x-forwarded-host") ?? "",
      request.headers.get("host") ?? "",
    ],
    paths: [WEBHOOK_PATH, new URL(request.url).pathname],
  });

  if (!valid) {
    console.error("[finik] подпись webhook не сошлась");

    // В разработке пропускаем: без публичного домена и настоящего ключа
    // подпись не сойдётся никогда, а проверить сценарий оплаты надо.
    if (process.env.NODE_ENV === "production") {
      return Response.json({ error: "invalid-signature" }, { status: 401 });
    }
  }

  const { clientId, reportId } = readMetadata(body);
  const transactionId = body.transactionId ?? body.id ?? null;

  if (!isSucceeded(body.status)) {
    console.warn(
      `[finik] платёж не прошёл: ${body.status} | отчёт ${reportId ?? "—"}`,
    );

    // Неуспешный платёж — тоже нормальное уведомление: доступ не открываем,
    // но подтверждаем получение, чтобы Finik не повторял.
    return Response.json({ success: true });
  }

  try {
    if (transactionId && (await isHandled(transactionId))) {
      console.info(`[finik] повтор webhook ${transactionId} — пропускаем`);

      return Response.json({ success: true });
    }

    // clientId мог не дойти — тогда находим владельца по идентификатору платежа.
    const paymentId = paymentIdOf(body);
    const owner = clientId ?? (paymentId ? await clientOfPayment(paymentId) : null);

    if (!owner) {
      console.error(
        `[finik] непонятно, кому открывать доступ: metadata и платёж ${paymentId ?? "—"} не дали clientId`,
      );

      return Response.json({ error: "missing-metadata" }, { status: 400 });
    }

    await markPaid(owner, {
      reportId: reportId ?? null,
      transactionId,
      amount: typeof body.amount === "number" ? body.amount : null,
      paidAt: Date.now(),
    });

    // Только после успешной отметки об оплате: иначе повтор от Finik был бы
    // отброшен как дубль, а доступ так и не открылся бы.
    if (transactionId) await markHandled(transactionId);

    console.info(
      `[finik] оплата подтверждена: отчёт ${reportId ?? "—"} | ${body.amount ?? "—"} KGS | транзакция ${transactionId ?? "—"} | хранилище ${storeKind()}`,
    );

    return Response.json({ success: true });
  } catch (error) {
    // 500, а не 200: Finik повторит уведомление, и оплата не останется без
    // доступа из-за минутной недоступности хранилища.
    console.error("[finik] не удалось открыть доступ", error);

    return Response.json({ error: "store-unavailable" }, { status: 500 });
  }
}
