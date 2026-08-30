/**
 * Отметки об оплате. Только сервер.
 *
 * Хранить нужно очень мало: «эта пара оплатила», «этот платёж принадлежит этой
 * паре» и «этот webhook уже обработан». Сам отчёт здесь не лежит — он ходит у
 * клиента в зашифрованном виде (см. seal.ts).
 *
 * Два хранилища:
 *
 * 1. Redis по REST (Upstash / Vercel KV) — рабочий вариант для Vercel. Там
 *    каждый запрос может попасть на свой инстанс, поэтому память процесса не
 *    годится: webhook отметил бы оплату в одном инстансе, а страница отчёта
 *    спросила бы другой. Работает по обычному fetch, без SDK.
 *
 * 2. Память процесса + файл во временной папке — для локальной разработки и
 *    обычного сервера (npm start на VPS). На Vercel это молча не работало бы,
 *    поэтому там отсутствие Redis — громкая ошибка в логах.
 */

import { readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Оплата живёт год: человек заплатил, доступ отбирать не за что. */
const PAID_TTL_S = 365 * 24 * 60 * 60;

/** Платёж ждём сутки: дольше QR всё равно не живёт. */
const PAYMENT_TTL_S = 24 * 60 * 60;

/** Обработанные webhook помним две недели — этого хватает на все повторы. */
const HANDLED_TTL_S = 14 * 24 * 60 * 60;

const PREFIX = "greenflag:paywall:";

export type PaymentInfo = {
  reportId: string | null;
  transactionId: string | null;
  amount: number | null;
  paidAt: number;
};

/** Хранилище недоступно. Отдельный тип, чтобы не спутать с «не оплачено». */
export class StoreUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Хранилище оплат недоступно");
    this.name = "StoreUnavailableError";
    this.cause = cause;
  }
}

/* ─── Redis по REST ────────────────────────────────────────────────────── */

type RedisConfig = { url: string; token: string };

function redisConfig(): RedisConfig | null {
  // KV_REST_API_* ставит интеграция Vercel, UPSTASH_* — сам Upstash.
  const url =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) return null;

  return { url: url.replace(/\/+$/, ""), token };
}

/** Одна команда Redis. Тело — массив в порядке протокола Redis. */
async function redisCommand(
  config: RedisConfig,
  args: (string | number)[],
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(config.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });
  } catch (error) {
    throw new StoreUnavailableError(error);
  }

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new StoreUnavailableError(`${response.status} ${details}`);
  }

  const data = (await response.json()) as { result?: unknown; error?: string };

  if (data.error) throw new StoreUnavailableError(data.error);

  return data.result ?? null;
}

/* ─── Память процесса + файл ───────────────────────────────────────────── */

type Entry = { value: string; expiresAt: number };

type Local = {
  data: Map<string, Entry>;
  loaded: Promise<void> | null;
  writing: Promise<void>;
};

const FILE = join(tmpdir(), "greenflag-paywall.json");

/**
 * Один экземпляр на процесс.
 *
 * На globalThis, а не в модуле: Next собирает каждый маршрут отдельно, поэтому
 * `/api/finik/webhook` и `/api/report/access` получают разные копии модуля. С
 * обычной переменной webhook отмечал бы оплату в своей копии, а страница
 * отчёта читала бы чужую пустую — оплата пропадала бы даже на одном сервере.
 */
const globalLocal = globalThis as typeof globalThis & {
  __greenflagPaywallStore?: Local;
};

const local: Local = (globalLocal.__greenflagPaywallStore ??= {
  data: new Map(),
  loaded: null,
  writing: Promise.resolve(),
});

function loadLocal(): Promise<void> {
  local.loaded ??= (async () => {
    try {
      const parsed = JSON.parse(await readFile(FILE, "utf8")) as Record<
        string,
        Entry
      >;

      const now = Date.now();
      for (const [key, entry] of Object.entries(parsed)) {
        if (entry.expiresAt > now) local.data.set(key, entry);
      }
    } catch {
      // Файла нет или он битый — начинаем с пустого хранилища.
    }
  })();

  return local.loaded;
}

function persistLocal(): Promise<void> {
  local.writing = local.writing.then(async () => {
    const temp = `${FILE}.${process.pid}.tmp`;

    try {
      await writeFile(temp, JSON.stringify(Object.fromEntries(local.data)), "utf8");
      await rename(temp, FILE);
    } catch (error) {
      // Отметка уже в памяти: упавшая запись ломает только переживание
      // перезапуска, поэтому просто пишем в лог.
      console.error("[paywall] не удалось сохранить отметки оплат", error);
    }
  });

  return local.writing;
}

/** Просроченное выкидываем при каждой записи: отдельный таймер не нужен. */
function sweepLocal(): void {
  const now = Date.now();

  for (const [key, entry] of local.data) {
    if (entry.expiresAt <= now) local.data.delete(key);
  }
}

/* ─── Общий доступ ─────────────────────────────────────────────────────── */

let warned = false;

/** На Vercel без Redis оплата не откроется — про это нужно знать сразу. */
function warnIfServerless(): void {
  if (warned || !process.env.VERCEL) return;
  warned = true;

  console.error(
    "[paywall] KV_REST_API_URL/KV_REST_API_TOKEN не заданы. На Vercel память " +
      "не общая между инстансами: подтверждение оплаты придёт в один, а " +
      "страница отчёта спросит другой, и доступ не откроется. Подключите " +
      "Upstash Redis (Storage → Redis) в проекте Vercel.",
  );
}

async function get(key: string): Promise<string | null> {
  const config = redisConfig();

  if (config) {
    const result = await redisCommand(config, ["GET", PREFIX + key]);

    return typeof result === "string" ? result : null;
  }

  warnIfServerless();
  await loadLocal();

  const entry = local.data.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    local.data.delete(key);

    return null;
  }

  return entry.value;
}

async function set(key: string, value: string, ttlSeconds: number): Promise<void> {
  const config = redisConfig();

  if (config) {
    await redisCommand(config, ["SET", PREFIX + key, value, "EX", ttlSeconds]);

    return;
  }

  warnIfServerless();
  await loadLocal();

  local.data.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  sweepLocal();
  await persistLocal();
}

/** Какое хранилище используется. Нужно для диагностики в логах. */
export function storeKind(): "redis" | "memory" {
  return redisConfig() ? "redis" : "memory";
}

/** Отмечаем оплату. Единственное, что открывает доступ. */
export async function markPaid(
  clientId: string,
  info: PaymentInfo,
): Promise<void> {
  await set(`paid:${clientId}`, JSON.stringify(info), PAID_TTL_S);
}

export async function isPaid(clientId: string): Promise<boolean> {
  if (!clientId) return false;

  return (await get(`paid:${clientId}`)) !== null;
}

/**
 * Связываем платёж с браузером.
 *
 * Запас на случай, если в webhook не дойдут metadata: по PaymentId владельца
 * всё равно можно найти.
 */
export async function rememberPayment(
  paymentId: string,
  clientId: string,
): Promise<void> {
  await set(`payment:${paymentId}`, clientId, PAYMENT_TTL_S);
}

export async function clientOfPayment(paymentId: string): Promise<string | null> {
  return get(`payment:${paymentId}`);
}

export async function isHandled(transactionId: string): Promise<boolean> {
  return (await get(`handled:${transactionId}`)) !== null;
}

/**
 * Помечаем webhook обработанным.
 *
 * Вызывается только после успешной отметки об оплате: если пометить раньше и
 * упасть на записи оплаты, повтор от Finik был бы отброшен как дубль, и доступ
 * не открылся бы никогда.
 */
export async function markHandled(transactionId: string): Promise<void> {
  await set(`handled:${transactionId}`, "1", HANDLED_TTL_S);
}
