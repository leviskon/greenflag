/**
 * Клиент Finik Acquiring API. Только сервер: ключи сюда попадают из окружения
 * и в браузер не уходят ни в каком виде.
 *
 * Платёж создаётся так: POST /v1/payment → Finik отвечает 302 с адресом своей
 * платёжной страницы, туда и уводим пару. Об успехе узнаём не от браузера, а
 * из webhook: редирект обратно пользователь может и не пройти (закрыл вкладку,
 * платил с телефона по QR), а webhook приходит всегда.
 */

import { createHash } from "node:crypto";
import { Signer } from "@mancho.devs/authorizer";

const FINIK_ENV = process.env.FINIK_ENV === "prod" ? "prod" : "beta";

const HOST =
  FINIK_ENV === "prod"
    ? "api.acquiring.averspay.kg"
    : "beta.api.acquiring.averspay.kg";

const BASE_URL = `https://${HOST}`;

/** Путь создания платежа. Он же участвует в подписи, поэтому вынесен. */
const PAYMENT_PATH = "/v1/payment";

/**
 * Код категории торговой точки (MCC).
 *
 * 0742 стоит по умолчанию, потому что он был в примере из руководства, но это
 * код ветеринарных услуг — Finik вполне может не принять его для вашей точки.
 * Настоящий код выдаёт Finik вместе с аккаунтом; подставляется через FINIK_MCC.
 */
const MERCHANT_CATEGORY_CODE = process.env.FINIK_MCC?.trim() || "0742";

/**
 * Имя, которое пара увидит в приложении банка. Только латиница.
 * Некоторые аккаунты требуют, чтобы оно совпадало с зарегистрированным.
 */
const MERCHANT_NAME = process.env.FINIK_MERCHANT_NAME?.trim() || "GreenFlag";

/**
 * Публичные ключи Finik: ими проверяется подпись webhook.
 * Ключи публичные и одинаковые для всех мерчантов — держим их в коде, чтобы
 * проверка работала без дополнительной настройки окружения.
 */
const PUBLIC_KEYS = {
  prod: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuF/PUmhMPPidcMxhZBPb
BSGJoSphmCI+h6ru8fG8guAlcPMVlhs+ThTjw2LHABvciwtpj51ebJ4EqhlySPyT
hqSfXI6Jp5dPGJNDguxfocohaz98wvT+WAF86DEglZ8dEsfoumojFUy5sTOBdHEu
g94B4BbrJvjmBa1YIx9Azse4HFlWhzZoYPgyQpArhokeHOHIN2QFzJqeriANO+wV
aUMta2AhRVZHbfyJ36XPhGO6A5FYQWgjzkI65cxZs5LaNFmRx6pjnhjIeVKKgF99
4OoYCzhuR9QmWkPl7tL4Kd68qa/xHLz0Psnuhm0CStWOYUu3J7ZpzRK8GoEXRcr8
tQIDAQAB
-----END PUBLIC KEY-----`,
  beta: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwlrlKz/8gLWd1ARWGA/8
o3a3Qy8G+hPifyqiPosiTY6nCHovANMIJXk6DH4qAqqZeLu8pLGxudkPbv8dSyG7
F9PZEAryMPzjoB/9P/F6g0W46K/FHDtwTM3YIVvstbEbL19m8yddv/xCT9JPPJTb
LsSTVZq5zCqvKzpupwlGS3Q3oPyLAYe+ZUn4Bx2J1WQrBu3b08fNaR3E8pAkCK27
JqFnP0eFfa817VCtyVKcFHb5ij/D0eUP519Qr/pgn+gsoG63W4pPHN/pKwQUUiAy
uLSHqL5S2yu1dffyMcMVi9E/Q2HCTcez5OvOllgOtkNYHSv9pnrMRuws3u87+hNT
ZwIDAQAB
-----END PUBLIC KEY-----`,
} as const;

/**
 * Приватный ключ из окружения.
 *
 * Живой ключ попадает сюда через панель хостинга, а там его портят одинаково:
 * копируют вместе с кавычками из строки .env, вставляют с «\n» вместо
 * переносов, теряют перенос перед END. Поэтому чиним всё это здесь, иначе
 * единственным симптомом будет 401 от Finik без объяснений.
 */
function privateKey(): string | null {
  let raw = process.env.FINIK_PRIVATE_KEY?.trim();
  if (!raw) return null;

  // Скопировали значение вместе с кавычками из .env.
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1).trim();
  }

  // Одна строка с «\n» — обычный вид для панелей хостинга.
  if (raw.includes("\\n")) raw = raw.replace(/\\n/g, "\n");

  // Переносы съел буфер обмена: тело ключа осталось, а строки склеились.
  if (!raw.includes("\n")) raw = rewrap(raw);

  return raw.endsWith("\n") ? raw : `${raw}\n`;
}

/** Собирает PEM обратно, если все переносы потерялись. */
function rewrap(flat: string): string {
  const match = /-----BEGIN ([A-Z ]+)-----(.*)-----END \1-----/.exec(flat);
  if (!match) return flat;

  const label = match[1];
  const body = match[2].replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g) ?? [];

  return [`-----BEGIN ${label}-----`, ...lines, `-----END ${label}-----`].join("\n");
}

/** Понятная причина, почему ключ не годится. null — с виду всё в порядке. */
function privateKeyProblem(key: string): string | null {
  if (!key.includes("-----BEGIN")) {
    return "FINIK_PRIVATE_KEY не похож на PEM: нет строки -----BEGIN … KEY-----";
  }

  if (!key.includes("-----END")) {
    return "FINIK_PRIVATE_KEY обрезан: нет строки -----END … KEY-----";
  }

  if (key.includes("PUBLIC KEY")) {
    return "В FINIK_PRIVATE_KEY лежит публичный ключ, нужен приватный";
  }

  return null;
}

/**
 * Отпечаток ключа: восемь символов от SHA-256.
 *
 * Нужен, чтобы в логах сверить, тот ли ключ подхватился, не показывая сам ключ.
 */
export function privateKeyFingerprint(): string | null {
  const key = privateKey();
  if (!key) return null;

  return createHash("sha256").update(key).digest("hex").slice(0, 8);
}

/**
 * Signer из библиотеки Finik печатает в консоль и тело запроса, и строку для
 * подписи — вместе с `x-api-key`. В логах сервера ключу не место, поэтому на
 * время вызова console.log замолкает.
 */
async function quietly<T>(action: () => Promise<T>): Promise<T> {
  const log = console.log;
  console.log = () => {};

  try {
    return await action();
  } finally {
    console.log = log;
  }
}

export type FinikStatus = "SUCCEEDED" | "FAILED" | "succeeded" | "failed";

/** Что уходит в metadata платежа и возвращается в webhook. */
export type PaymentMetadata = {
  /** Кому открывать доступ. */
  clientId: string;
  /** Какой отчёт оплачивают. Нужен только для логов и разбора обращений. */
  reportId: string;
};

export type CreatePaymentInput = PaymentMetadata & {
  /** Сумма в сомах. Приходит из окружения, не от клиента. */
  amount: number;
  /** Куда вернуть пару после оплаты. */
  redirectUrl: string;
  /** Куда Finik пришлёт подтверждение. */
  webhookUrl: string;
  /** Человекочитаемое назначение платежа. */
  description: string;
};

export type CreatePaymentResult = {
  paymentId: string;
  paymentUrl: string;
};

/**
 * Сбой на стороне Finik или подписи.
 *
 * `detail` — короткая причина без секретов: её видно и в логах, и в ответе
 * маршрута. Без неё любая проблема выглядела бы одинаково («не удалось начать
 * оплату»), и отличить неверный ключ от неверной суммы было бы нечем.
 */
export class FinikError extends Error {
  readonly detail: string;

  constructor(detail: string, cause?: unknown) {
    super(detail);
    this.name = "FinikError";
    this.detail = detail;
    this.cause = cause;
  }
}

/** Понятная причина, почему оплату нельзя начать. null — всё настроено. */
export function finikConfigError(): string | null {
  if (!process.env.FINIK_API_KEY) return "FINIK_API_KEY не задан";
  if (!process.env.FINIK_ACCOUNT_ID) return "FINIK_ACCOUNT_ID не задан";

  const key = privateKey();

  if (FINIK_ENV === "prod" && key === null) {
    return 'FINIK_PRIVATE_KEY обязателен при FINIK_ENV="prod"';
  }

  return key ? privateKeyProblem(key) : null;
}

/**
 * Создаёт платёж и возвращает адрес платёжной страницы Finik.
 * Бросает исключение с понятным текстом — вызывающий превращает его в 5xx.
 */
export async function createFinikPayment(
  input: CreatePaymentInput,
): Promise<CreatePaymentResult> {
  const problem = finikConfigError();
  if (problem) throw new FinikError(problem);

  const apiKey = process.env.FINIK_API_KEY as string;
  const accountId = process.env.FINIK_ACCOUNT_ID as string;

  const timestamp = Date.now().toString();
  const paymentId = crypto.randomUUID();

  const body = {
    Amount: input.amount,
    CardType: "FINIK_QR",
    PaymentId: paymentId,
    RedirectUrl: input.redirectUrl,
    Data: {
      accountId,
      merchantCategoryCode: MERCHANT_CATEGORY_CODE,
      name_en: MERCHANT_NAME,
      description: input.description,
      webhookUrl: input.webhookUrl,
      metadata: JSON.stringify({
        clientId: input.clientId,
        reportId: input.reportId,
        paymentId,
      } satisfies PaymentMetadata & { paymentId: string }),
    },
  };

  // Подпись считается по методу, пути, заголовкам host + x-api-* и телу.
  const signed = {
    httpMethod: "POST",
    path: PAYMENT_PATH,
    headers: {
      Host: HOST,
      "x-api-key": apiKey,
      "x-api-timestamp": timestamp,
    },
    queryStringParameters: null,
    body,
  };

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "x-api-timestamp": timestamp,
  };

  // В beta подпись не требуется, в prod без неё запрос отклонят.
  const key = privateKey();
  if (key) {
    try {
      headers.signature = await quietly(() => new Signer(signed).sign(key));
    } catch (error) {
      console.error("[finik] не удалось подписать запрос", error);

      throw new FinikError("подпись не собралась: ключ не читается", error);
    }
  }

  const response = await fetch(`${BASE_URL}${PAYMENT_PATH}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    // Нам нужен сам 302: адрес платёжной страницы лежит в Location.
    redirect: "manual",
    cache: "no-store",
  });

  if (response.status === 302 || response.status === 301) {
    const paymentUrl = response.headers.get("location");

    if (!paymentUrl) {
      throw new FinikError("Finik не вернул адрес платёжной страницы");
    }

    if (isRejected(paymentUrl)) {
      console.error(`[finik] отказ при создании платежа: ${paymentUrl}`);

      throw new FinikError(`Finik отклонил платёж: ${reasonFrom(paymentUrl)}`);
    }

    return { paymentId, paymentUrl };
  }

  const answer = await response.text().catch(() => "");
  console.error(`[finik] создание платежа: ${response.status} ${answer}`);

  throw new FinikError(`Finik ответил ${response.status}: ${messageFrom(answer)}`);
}

/**
 * Finik отказал в создании платежа.
 *
 * Отказ выглядит как редирект на свой же `/v1/redirect` со `status=failed`.
 * Искать эту подстроку по всему адресу нельзя: у успешного платежа тот же
 * `status=failed` лежит внутри параметра `failure_redirect_url` — это адрес,
 * куда Finik уйдёт, ЕСЛИ пара не оплатит. Причём вложенный адрес не закодирован,
 * поэтому его параметры выглядят как параметры внешнего. Отличаем по пути:
 * успешный платёж — это страница с QR-кодом на qr.finik.kg, а не /v1/redirect.
 */
function isRejected(url: string): boolean {
  try {
    const { pathname, searchParams } = new URL(url);

    if (!pathname.startsWith("/v1/redirect")) return false;

    return searchParams.get("status") === "failed";
  } catch {
    // Адрес не разобрался — считаем платёж созданным: браузер разберётся.
    return false;
  }
}

/** Причина отказа из адреса редиректа. */
function reasonFrom(url: string): string {
  try {
    const params = new URL(url).searchParams;

    // Названия полей у Finik не задокументированы, поэтому собираем всё, что
    // похоже на объяснение, и отдаём как есть.
    const parts = [...params]
      .filter(([name]) => name.toLowerCase() !== "status")
      .map(([name, value]) => `${name}=${value}`);

    return parts.length > 0 ? parts.join(", ") : "причина не указана";
  } catch {
    return url;
  }
}

/** Текст ошибки из тела ответа Finik. */
function messageFrom(body: string): string {
  try {
    const parsed = JSON.parse(body) as { ErrorMessage?: string; message?: string };

    return parsed.ErrorMessage ?? parsed.message ?? body.slice(0, 200);
  } catch {
    return body.slice(0, 200) || "без тела";
  }
}

/** Данные, которые Finik присылает в webhook. */
export type FinikWebhookBody = {
  id?: string;
  transactionId?: string;
  status?: FinikStatus | string;
  amount?: number;
  transactionDate?: number;
  clientId?: string;
  fields?: Record<string, unknown>;
  data?: {
    accountId?: string;
    metadata?: string | Record<string, unknown>;
    [key: string]: unknown;
  };
};

/**
 * Проверка подписи webhook.
 *
 * `Host` и путь участвуют в подписи, а за прокси они приходят по-разному
 * (`host` — внутренний, `x-forwarded-host` — внешний). Поэтому проверяем все
 * разумные варианты: достаточно одного совпадения.
 */
export async function verifyFinikWebhook({
  signature,
  timestamp,
  body,
  hosts,
  paths,
}: {
  signature: string;
  timestamp: string;
  body: Record<string, unknown>;
  hosts: string[];
  paths: string[];
}): Promise<boolean> {
  const publicKey = PUBLIC_KEYS[FINIK_ENV];

  for (const host of hosts) {
    if (!host) continue;

    for (const path of paths) {
      const signed = {
        httpMethod: "POST",
        path,
        headers: { Host: host, "x-api-timestamp": timestamp },
        queryStringParameters: null,
        body,
      };

      try {
        const valid = await quietly(() =>
          new Signer(signed).verify(publicKey, signature),
        );

        if (valid) return true;
      } catch (error) {
        console.error("[finik] ошибка проверки подписи webhook", error);

        return false;
      }
    }
  }

  return false;
}

/** Защита от повторной отправки старого webhook. */
export function isTimestampValid(timestamp: string, maxAgeMinutes = 10): boolean {
  const requestTime = Number(timestamp);
  if (!Number.isFinite(requestTime)) return false;

  const minutes = Math.abs(Date.now() - requestTime) / 60_000;

  return minutes <= maxAgeMinutes;
}

/** Успешный платёж: Finik присылает статус в разном регистре. */
export function isSucceeded(status: string | undefined): boolean {
  return status?.toUpperCase() === "SUCCEEDED";
}

/** Метаданные из webhook. Пустой объект, если их нет или они битые. */
export function readMetadata(body: FinikWebhookBody): Partial<PaymentMetadata> {
  const raw = body.data?.metadata;
  if (!raw) return {};

  try {
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (typeof parsed !== "object" || parsed === null) return {};

    const source = parsed as Record<string, unknown>;

    return {
      clientId:
        typeof source.clientId === "string" ? source.clientId : undefined,
      reportId:
        typeof source.reportId === "string" ? source.reportId : undefined,
    };
  } catch {
    return {};
  }
}

export const finikEnv = FINIK_ENV;
