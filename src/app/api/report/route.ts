/**
 * Разбор отчёта нейросетью и раздача его открытой части.
 *
 * Клиент присылает состояние теста, сервер отдаёт проверенные метки и числа —
 * но только по трём бесплатным блокам. Закрытая часть (блоки 4–10) считается
 * здесь же и уходит клиенту запечатанной: расшифровать её может только сервер
 * и только после подтверждённой оплаты. Поэтому до оплаты в браузере нет ни
 * текстов, ни чисел — ни в ответе, ни в localStorage, ни в devtools.
 *
 * Ключ провайдера остаётся здесь: в браузер он не уходит ни в каком виде.
 *
 * Внимание: маршрут открытый — авторизации у приложения нет, а каждый вызов
 * стоит денег. Поэтому здесь есть ограничение по размеру тела, проверка
 * источника запроса и грубый лимит частоты. Полноценный лимит нужно вешать
 * выше (на прокси или через хранилище), в памяти процесса он живёт только до
 * перезапуска и не работает между несколькими инстансами.
 */

import { hasAiKey, requestAnalysis } from "@/lib/ai/client";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompt";
import { getDictionary } from "@/lib/i18n/dictionary";
import {
  freeAnalysis,
  isId,
  lockedFrom,
  REPORT_CURRENCY,
  REPORT_PRICE,
  type AccessPayload,
} from "@/lib/paywall/plan";
import { seal } from "@/lib/paywall/seal";
import { isPaid, StoreUnavailableError } from "@/lib/paywall/store";
import { buildReport } from "@/lib/report";
import { parseStateValue } from "@/lib/storage";

/**
 * Разбор у модели занимает 10–20 секунд, а по умолчанию функция на Vercel
 * живёт 10–15 секунд и обрывается на середине. Ставим запас: 60 секунд
 * разрешены на всех тарифах, включая бесплатный.
 */
export const maxDuration = 60;

/** Ответы пары — это текст, 64 КБ хватает с запасом. */
const MAX_BODY = 64 * 1024;

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 12;

const hits = new Map<string, number[]>();

function tooManyRequests(ip: string): boolean {
  const now = Date.now();
  const fresh = (hits.get(ip) ?? []).filter((time) => now - time < RATE_WINDOW_MS);

  fresh.push(now);
  hits.set(ip, fresh);

  // Карта не должна расти бесконечно на живом сервере.
  if (hits.size > 500) {
    for (const [key, times] of hits) {
      if (times.every((time) => now - time >= RATE_WINDOW_MS)) hits.delete(key);
    }
  }

  return fresh.length > RATE_LIMIT;
}

/**
 * Запрос пришёл со стороннего сайта.
 *
 * Хост, на который пришёл запрос, берём из заголовков, а не из `request.url`:
 * там оказывается адрес, по которому Next обращается сам к себе (localhost), а
 * браузер присылает в Origin то, что стоит в адресной строке — например
 * 192.168.1.10:3000 с телефона в той же сети. Из-за этого свой же запрос
 * выглядел чужим, отдавался 403, и отчёт молча считался формулами.
 *
 * Протокол не сверяем: за прокси снаружи https, а внутрь приходит http.
 * Если хост не пришёл, ведём себя как при отсутствии Origin — пропускаем.
 */
function wrongOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;

  try {
    if (new URL(origin).host === host) return false;
  } catch {
    return true;
  }

  // Причину видно в логе: иначе отказ выглядит как молчаливый сбой разбора.
  console.warn(`[report] origin ${origin} не совпал с хостом ${host}`);

  return true;
}

function fail(reason: string, status = 200) {
  return Response.json({ ok: false, reason }, { status });
}

export async function POST(request: Request) {
  if (wrongOrigin(request)) return fail("bad-origin", 403);

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (tooManyRequests(ip)) return fail("rate-limit", 429);

  const body = await request.text();
  if (body.length > MAX_BODY) return fail("too-large", 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return fail("bad-body", 400);
  }

  const payload = parsed as { state?: unknown; clientId?: unknown };

  const state = parseStateValue(payload.state);
  if (!state) return fail("bad-state", 400);

  // Идентификатор пары нужен, чтобы связать оплату с браузером: он же уходит в
  // metadata платежа, приходит обратно в webhook и запечатывается в отчёт.
  if (!isId(payload.clientId)) return fail("bad-client", 400);
  const clientId = payload.clientId;

  const dict = await getDictionary(state.locale);

  // Черновые оценки по формулам: они же уходят в промпт как ориентир и они же
  // остаются в отчёте, если модель какое-то число не пришлёт.
  const baseline = buildReport(state, dict.quiz);
  if (!baseline.hasData) return fail("no-answers", 400);

  // Разбор нейросети. Не получился — отчёт живёт на формулах, и платный доступ
  // должен работать точно так же, поэтому маршрут не обрывается.
  let analysis = null;
  let reason: string | null = null;

  if (!hasAiKey()) {
    reason = "no-key";
  } else {
    const result = await requestAnalysis(
      buildSystemPrompt(state.locale),
      buildUserPrompt(state, dict.quiz, baseline),
    );

    if (result.ok) {
      analysis = result.analysis;

      console.info(
        `[report] ok: ${result.usage.input} in / ${result.usage.output} out`,
      );
    } else {
      reason = result.reason;
      console.error(`[report] ai failed: ${result.reason}`);
    }
  }

  // Полный отчёт собирается только здесь. Закрытая часть уходит клиенту
  // запечатанной — открыть её он сам не может.
  const full = analysis ? buildReport(state, dict.quiz, analysis) : baseline;
  const locked = lockedFrom(full);

  const reportId = crypto.randomUUID();
  const sealed = seal(locked, clientId);

  // Пара уже платила раньше — открываем сразу, второй раз брать деньги не за что.
  let paid = false;
  let storeOk = true;

  try {
    paid = await isPaid(clientId);
  } catch (error) {
    storeOk = false;
    console.error("[report] хранилище оплат недоступно", error);

    if (!(error instanceof StoreUnavailableError)) throw error;
  }

  const access: AccessPayload = {
    ok: storeOk,
    paid,
    price: REPORT_PRICE,
    currency: REPORT_CURRENCY,
    locked: paid ? locked : null,
  };

  return Response.json({
    ok: true,
    reportId,
    analysis: analysis ? freeAnalysis(analysis) : null,
    reason,
    sealed,
    access,
  });
}
