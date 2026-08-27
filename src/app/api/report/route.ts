/**
 * Разбор отчёта нейросетью.
 *
 * Клиент присылает состояние теста, сервер отдаёт проверенные метки и числа.
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
import { buildReport } from "@/lib/report";
import { parseStateValue } from "@/lib/storage";

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

function wrongOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin !== new URL(request.url).origin;
  } catch {
    return true;
  }
}

function fail(reason: string, status = 200) {
  return Response.json({ ok: false, reason }, { status });
}

export async function POST(request: Request) {
  if (wrongOrigin(request)) return fail("bad-origin", 403);
  if (!hasAiKey()) return fail("no-key");

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

  const state = parseStateValue((parsed as { state?: unknown })?.state);
  if (!state) return fail("bad-state", 400);

  const dict = await getDictionary(state.locale);

  // Черновые оценки по формулам: они же уходят в промпт как ориентир и они же
  // остаются в отчёте, если модель какое-то число не пришлёт.
  const baseline = buildReport(state, dict.quiz);
  if (!baseline.hasData) return fail("no-answers", 400);

  const result = await requestAnalysis(
    buildSystemPrompt(state.locale),
    buildUserPrompt(state, dict.quiz, baseline),
  );

  if (!result.ok) {
    console.error(`[report] ai failed: ${result.reason}`);

    return fail(result.reason);
  }

  console.info(
    `[report] ok: ${result.usage.input} in / ${result.usage.output} out`,
  );

  return Response.json({ ok: true, analysis: result.analysis });
}
