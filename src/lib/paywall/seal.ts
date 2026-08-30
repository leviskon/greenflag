/**
 * Запечатывание закрытой части отчёта. Только сервер.
 *
 * Зачем это нужно. На Vercel каждый запрос может попасть на свой инстанс, а
 * общей памяти и диска у них нет. Хранить отчёт на сервере значит завести под
 * него базу — при том что храниться он должен ровно для одного браузера.
 *
 * Поэтому закрытую часть носит сам клиент, но в зашифрованном виде: в
 * localStorage лежит база64-шум, расшифровать который может только сервер и
 * только по своему ключу. В devtools достать оттуда нечего, а серверу не нужно
 * ничего помнить — достаточно знать, что эта пара оплатила.
 *
 * AES-256-GCM: шифр с проверкой целостности. Подмена байта, чужой clientId или
 * склейка из двух отчётов дают ошибку расшифровки, а не «другие числа».
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/** Версия формата: если поменяется схема, старые пакеты просто не откроются. */
const VERSION = "v1";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

/**
 * Материал для ключа.
 *
 * PAYWALL_SECRET — правильный путь. Если его нет, берём ключ Finik: он всегда
 * задан, секретен и одинаков на всех инстансах, поэтому шифрование работает
 * без дополнительной настройки. Минус — при ротации ключа Finik старые пакеты
 * перестанут открываться (пара увидит «отчёт устарел»), поэтому на продакшене
 * лучше задать PAYWALL_SECRET явно.
 */
function secret(): string | null {
  const explicit = process.env.PAYWALL_SECRET?.trim();
  if (explicit) return explicit;

  return process.env.FINIK_API_KEY?.trim() || null;
}

let cachedKey: Buffer | null = null;

function key(): Buffer | null {
  if (cachedKey) return cachedKey;

  const material = secret();
  if (!material) return null;

  // HKDF: из произвольной строки получаем ключ нужной длины и не используем
  // сам секрет как ключ шифрования напрямую.
  cachedKey = Buffer.from(
    hkdfSync("sha256", material, "greenflag.paywall.v1", "locked-report", KEY_BYTES),
  );

  return cachedKey;
}

export function canSeal(): boolean {
  return key() !== null;
}

/**
 * Пакует значение в строку, которую можно отдать браузеру.
 *
 * `clientId` входит в подпись (AAD), поэтому пакет открывается только для того
 * браузера, для которого собран: чужой отчёт по чужому пакету не прочитать.
 */
export function seal(value: unknown, clientId: string): string | null {
  const secretKey = key();
  if (!secretKey) {
    console.error("[paywall] нет ключа шифрования: задайте PAYWALL_SECRET");

    return null;
  }

  try {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, secretKey, iv);

    cipher.setAAD(Buffer.from(clientId, "utf8"));

    const body = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);

    return [
      VERSION,
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      body.toString("base64url"),
    ].join(".");
  } catch (error) {
    console.error("[paywall] не удалось запечатать отчёт", error);

    return null;
  }
}

/** Распаковывает пакет. null — не наш пакет, испорчен или собран для другого. */
export function unseal(sealed: unknown, clientId: string): unknown {
  if (typeof sealed !== "string" || !sealed) return null;

  const secretKey = key();
  if (!secretKey) return null;

  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      secretKey,
      Buffer.from(parts[1], "base64url"),
    );

    decipher.setAAD(Buffer.from(clientId, "utf8"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));

    const plain = Buffer.concat([
      decipher.update(Buffer.from(parts[3], "base64url")),
      decipher.final(),
    ]).toString("utf8");

    return JSON.parse(plain);
  } catch {
    // Ключ сменился, пакет подправили руками или он от другого браузера.
    return null;
  }
}
