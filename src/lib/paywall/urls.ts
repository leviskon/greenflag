/**
 * Внешние адреса приложения. Только сервер.
 *
 * Finik нужны два адреса: куда вернуть пару после оплаты и куда прислать
 * подтверждение. Оба должны быть видны из интернета, поэтому по умолчанию
 * берём их из заголовков запроса — так адрес всегда совпадает с тем, по
 * которому приложение реально открыто, и при переезде на домен править
 * окружение не нужно.
 *
 * NEXT_PUBLIC_APP_URL перекрывает это поведение: он нужен, только если перед
 * приложением стоит прокси, который не проставляет x-forwarded-*.
 */

import type { Locale } from "@/lib/i18n/config";

/** Путь, на который Finik присылает подтверждение оплаты. */
export const WEBHOOK_PATH = "/api/finik/webhook";

function fromEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;

  return raw.replace(/\/+$/, "");
}

function fromRequest(request: Request): string {
  const headers = request.headers;

  const host =
    headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";

  // За прокси снаружи https, а внутрь приходит http — поэтому доверяем
  // x-forwarded-proto, а без него смотрим на сам адрес.
  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${proto}://${host}`;
}

export function appUrl(request: Request): string {
  return fromEnv() ?? fromRequest(request);
}

export function webhookUrl(request: Request): string {
  return `${appUrl(request)}${WEBHOOK_PATH}`;
}

/**
 * Куда Finik вернёт пару после оплаты.
 *
 * `payment=success` — только повод перепроверить доступ на сервере, сам по себе
 * этот параметр ничего не открывает. Идентификаторов в адресе намеренно нет:
 * пересланная ссылка не должна открывать чужой отчёт.
 */
export function redirectUrl(request: Request, locale: Locale): string {
  return `${appUrl(request)}/${locale}/report?payment=success`;
}

/** Адрес доступен из интернета: локальный webhook Finik не дойдёт. */
export function isReachable(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url);

    if (protocol !== "https:") return false;

    return !(
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}
