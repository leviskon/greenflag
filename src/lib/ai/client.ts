/**
 * Запрос к модели. Только серверный код: ключ из .env в браузер не попадает.
 *
 * Отдельный модуль, чтобы провайдера можно было заменить, не трогая ни промпт,
 * ни проверку ответа.
 */

import { parseAnalysisText, type Analysis } from "./analysis";

const ENDPOINT = "https://api.anthropic.com/v1/messages";

/** Задача простая — выбрать метку и оценить проценты, поэтому берём быструю. */
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

/** Ответ — короткий JSON. Запас нужен только на случай длинных текстов. */
const MAX_TOKENS = 700;

/** Числа должны быть устойчивыми: одинаковые ответы — похожий отчёт. */
const TEMPERATURE = 0.3;

const TIMEOUT_MS = 30_000;

export type AiResult =
  | { ok: true; analysis: Analysis; usage: { input: number; output: number } }
  | { ok: false; reason: string };

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { type?: string; message?: string };
};

export function hasAiKey(): boolean {
  return Boolean(process.env.AI_API?.trim());
}

export async function requestAnalysis(
  system: string,
  user: string,
): Promise<AiResult> {
  const key = process.env.AI_API?.trim();
  if (!key) return { ok: false, reason: "no-key" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system,
        messages: [
          { role: "user", content: user },
          // Ответ начат за модель: так она физически не может начать с
          // «Конечно, вот JSON» и сломать разбор.
          { role: "assistant", content: "{" },
        ],
      }),
    });

    const data = (await response.json()) as AnthropicResponse;

    if (!response.ok) {
      // В логи уходит только тип ошибки провайдера: ни ключа, ни ответов пары.
      return {
        ok: false,
        reason: `http-${response.status}:${data.error?.type ?? "unknown"}`,
      };
    }

    const body = (data.content ?? [])
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("");

    const analysis = parseAnalysisText(`{${body}`);
    if (!analysis) return { ok: false, reason: "bad-json" };

    return {
      ok: true,
      analysis,
      usage: {
        input: data.usage?.input_tokens ?? 0,
        output: data.usage?.output_tokens ?? 0,
      },
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";

    return { ok: false, reason: aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
