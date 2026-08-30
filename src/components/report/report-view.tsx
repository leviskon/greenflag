"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "@/components/ui";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/ru";
import {
  ARCHETYPE_ART,
  POWER_ART,
  RISK_ART,
} from "@/lib/content";
import { buildReport, type FlagCount, type Tone } from "@/lib/report";
import { PortraitCarousel } from "./portrait-carousel";
import {
  clearState,
  parseState,
  readAnalysisRecord,
  readRawAnalysis,
  readRawState,
  readServerState,
  subscribeToState,
} from "@/lib/storage";
import { guardAnalysis } from "@/lib/ai/analysis";
import { DEFAULT_ACCESS, fetchAccess, startPayment } from "@/lib/paywall/client";
import type { AccessPayload } from "@/lib/paywall/plan";
import {
  LockedBlock,
  PaidNote,
  PaywallCard,
  type PaywallStatus,
} from "./paywall";
import { Bar, Donut, NoteCard, ReportBlock, TONE_TEXT } from "./report-ui";

/**
 * Признак «мы уже в браузере»: на сервере и при гидрации false, дальше true.
 * Через внешний источник, а не через эффект: до гидрации localStorage читать
 * нельзя, а пустое состояние показывать рано — данные могут быть.
 */
const neverChanges = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** Корень отчёта: по нему сборщик PDF находит блоки. */
const REPORT_ROOT_ID = "report-root";

/**
 * Сколько раз спрашиваем сервер после возврата с оплаты.
 *
 * Доступ открывает не редирект, а webhook от Finik, и он приходит на секунду-
 * две позже, чем браузер возвращается на страницу. Поэтому не проверяем один
 * раз, а недолго опрашиваем — иначе пара увидела бы замки сразу после оплаты.
 */
const RETURN_ATTEMPTS = 12;
const RETURN_DELAY_MS = 2500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Цвет кольца риска: чем выше процент, тем тревожнее. */
function toneOfRisk(value: number): Tone {
  if (value >= 65) return "bad";

  return value >= 40 ? "mid" : "good";
}

/** Пара вернулась со страницы оплаты. */
function returnedFromPayment(): boolean {
  if (typeof window === "undefined") return false;

  return new URLSearchParams(window.location.search).get("payment") === "success";
}

/** Убираем ?payment=success, чтобы обновление страницы не начинало опрос заново. */
function forgetPaymentQuery(): void {
  if (typeof window === "undefined") return;
  if (!window.location.search) return;

  window.history.replaceState(null, "", window.location.pathname);
}

export function ReportView({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.reportPage;
  const who = dict.anatomy.who;

  // Снимок localStorage: на сервере пустой, после гидрации — настоящий.
  const raw = useSyncExternalStore(
    subscribeToState,
    readRawState,
    readServerState,
  );
  const stored = useMemo(() => parseState(raw), [raw]);

  // Разбор нейросети лежит отдельным ключом и подписан ответами: чужой или
  // устаревший до отчёта не доходит.
  const rawAnalysis = useSyncExternalStore(
    subscribeToState,
    readRawAnalysis,
    readServerState,
  );

  const record = useMemo(
    () => readAnalysisRecord(rawAnalysis, stored),
    [rawAnalysis, stored],
  );

  const analysis = useMemo(
    () => guardAnalysis(record.analysis),
    [record.analysis],
  );

  /** Номер отчёта для платежа и запечатанная закрытая часть для сервера. */
  const { reportId, sealed } = record;

  const router = useRouter();
  const ready = useSyncExternalStore(neverChanges, onClient, onServer);

  /**
   * Платный доступ.
   *
   * `access.locked` — единственный источник блоков 4–10. До оплаты его нет, и
   * подставить его в devtools бессмысленно: правка состояния страницы живёт до
   * первого обновления, а с сервера данные всё равно не придут.
   */
  const [access, setAccess] = useState<AccessPayload>(DEFAULT_ACCESS);
  const [status, setStatus] = useState<PaywallStatus>("idle");

  /** «Оплата прошла» показываем только тому, кто прямо сейчас вернулся с неё. */
  const [justPaid, setJustPaid] = useState(false);

  // Уходим на тест заново: пока идёт переход, отчёт уже пустой, поэтому
  // показываем загрузку, а не карточку «отчёта пока нет».
  const [restarting, setRestarting] = useState(false);

  /** Сборка PDF занимает секунду-две: на это время кнопка занята. */
  const [pdfBusy, setPdfBusy] = useState(false);

  const report = useMemo(
    () => (stored ? buildReport(stored, dict.quiz, analysis) : null),
    [stored, dict.quiz, analysis],
  );

  /**
   * Спрашиваем доступ у сервера.
   *
   * Сразу при открытии — чтобы уже оплаченный отчёт открывался сам, и ещё раз
   * после возврата с оплаты, пока не придёт подтверждение.
   */
  useEffect(() => {
    if (!ready || !stored) return;

    // Запечатанной части нет: запрос на разбор не дошёл или запись от прошлой
    // версии. Открывать нечего — статус «expired» считается ниже.
    if (!sealed) return;

    let cancelled = false;
    const returned = returnedFromPayment();

    void (async () => {
      if (returned) setStatus("checking");

      const attempts = returned ? RETURN_ATTEMPTS : 1;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const next = await fetchAccess(sealed);
        if (cancelled) return;

        // Цену берём из ответа даже без оплаты: она задана на сервере.
        setAccess(next);

        if (next.paid) {
          setStatus("idle");
          setJustPaid(returned && next.locked !== null);
          forgetPaymentQuery();

          return;
        }

        if (attempt + 1 < attempts) {
          await wait(RETURN_DELAY_MS);
          if (cancelled) return;
        }
      }

      if (returned) {
        setStatus("pending");
        forgetPaymentQuery();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, stored, sealed]);

  const recheck = useCallback(async () => {
    if (!sealed) return;

    setStatus("checking");
    const next = await fetchAccess(sealed);

    setAccess(next);
    setJustPaid(next.locked !== null);
    setStatus(next.paid ? "idle" : "pending");
  }, [sealed]);

  const pay = useCallback(async () => {
    if (!reportId || !sealed) {
      setStatus("expired");

      return;
    }

    setStatus("busy");
    const result = await startPayment(reportId, locale);

    if (result.kind === "redirect") {
      // Уходим на страницу Finik: там QR-код и приложение банка.
      window.location.href = result.url;

      return;
    }

    if (result.kind === "paid") {
      await recheck();

      return;
    }

    // Оплату нельзя начать по вине сервера — это не «попробуйте ещё раз».
    const blocked =
      result.reason === "not-configured" || result.reason === "store-unavailable";

    setStatus(blocked ? "unavailable" : "error");
  }, [reportId, sealed, locale, recheck]);

  /**
   * Закрытая часть отчёта. null — доступ не оплачен, и блоки 4–10 рисуются
   * заглушками. Ничего «спрятанного» в разметке при этом нет: данных для них
   * на странице просто не существует.
   */
  const locked = access.locked;
  const pw = t.paywall;

  /**
   * Открывать нечего в двух случаях: запечатанной части нет вовсе (запрос на
   * разбор не дошёл, запись от прошлой версии) или она больше не открывается —
   * это видно по «оплачено, а закрытой части нет». Второе важно не спутать с
   * «не оплачено», иначе оплатившей паре снова показали бы кнопку оплаты.
   *
   * `ok: false` — сервер не смог проверить оплату; предлагать оплату в этот
   * момент тоже нельзя, поэтому отдельный статус.
   *
   * Оба состояния вычисляемые, а не в state: иначе они зависели бы от порядка
   * эффектов.
   */
  const paywallStatus: PaywallStatus = !sealed
    ? "expired"
    : !access.ok
      ? "retry"
      : access.paid && locked === null
        ? "expired"
        : status;

  /** Имя файла: «GreenFlag — отчёт Катя и Сергей.pdf». */
  function pdfFileName(): string {
    const she = report?.names.she.trim();
    const he = report?.names.he.trim();

    const title =
      she && he
        ? t.actions.pdfFile.replace("{she}", she).replace("{he}", he)
        : t.metaTitle;

    // Символы, недопустимые в именах файлов, браузер вырежет сам, но лучше
    // отдать сразу чистое имя.
    return `${title.replace(/[\\/:*?"<>|]/g, " ").trim()}.pdf`;
  }

  /**
   * Сборка PDF на устройстве, без окна печати. Если что-то не срослось
   * (старый браузер, незагруженная картинка), уходим в печать — там пара
   * сможет сохранить файл сама.
   */
  async function handleSavePdf() {
    const root = document.getElementById(REPORT_ROOT_ID);
    if (!root || pdfBusy) return;

    setPdfBusy(true);

    try {
      const { downloadReportPdf } = await import("@/lib/pdf");
      await downloadReportPdf(root, pdfFileName());
    } catch (error) {
      console.error("[report] pdf failed", error);
      window.print();
    } finally {
      setPdfBusy(false);
    }
  }

  const header = (
    <header className="no-print sticky top-0 z-30 bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-2xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href={`/${locale}`}
          className="font-display text-base font-extrabold tracking-tight"
        >
          Green<span className="text-pink-500">Flag</span>
        </Link>

        {/* Кнопки «Поделиться» здесь не будет: ответы и разбор лежат в
            localStorage, по ссылке на другом устройстве откроется пустая
            страница. */}
        <button
          type="button"
          onClick={() => void handleSavePdf()}
          disabled={pdfBusy}
          aria-busy={pdfBusy}
          className="shadow-pill rounded-full bg-pink-500 px-3 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-pink-600 disabled:opacity-70"
        >
          {pdfBusy ? t.actions.pdfBusy : t.actions.pdf}
        </button>
      </div>
    </header>
  );

  function handleRestart() {
    setRestarting(true);
    clearState();
    router.push(`/${locale}/test`);
  }

  if (!ready || restarting) {
    return (
      <div className="flex min-h-dvh flex-col bg-canvas">
        {header}
        <p className="m-auto text-sm text-ink-soft">{t.loading}</p>
      </div>
    );
  }

  if (!stored || !report || !report.hasData) {
    return (
      <div className="flex min-h-dvh flex-col bg-canvas">
        {header}
        <div className="m-auto w-full max-w-sm px-4 text-center">
          <span aria-hidden className="text-3xl">
            📄
          </span>
          <h1 className="mt-3 text-xl font-extrabold">{t.empty.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {t.empty.text}
          </p>
          <Link
            href={`/${locale}/test`}
            className="shadow-pill mt-5 inline-flex rounded-full bg-pink-500 px-6 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-pink-600"
          >
            {t.empty.cta}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="print-root min-h-dvh bg-canvas">
      {header}

      {/* id — корень для сборки PDF: из него берутся блоки с data-pdf-block. */}
      {/* reveal: блоки появляются по очереди сверху вниз — см. globals.css. */}
      <main
        id={REPORT_ROOT_ID}
        className="print-body reveal mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pb-10 sm:px-6"
      >
        {/* Шапка отчёта: заголовок и подводка, картинка задаёт высоту блока */}
        <section
          data-pdf-block
          className="rounded-block shadow-block avoid-break flex items-center gap-3 bg-white p-4 print:shadow-none sm:p-6"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold tracking-[0.06em] text-pink-600 uppercase">
              {t.hero.tag}
            </p>
            <h1 className="mt-1 text-[24px] leading-[1.05] font-extrabold sm:text-[30px]">
              {t.hero.titleLead}{" "}
              <span className="text-accent">{t.hero.titleAccent}</span>
            </h1>
            <p className="mt-2.5 text-[13px] leading-snug font-bold text-ink-soft sm:text-sm">
              {t.hero.lead}
            </p>
          </div>

          <Image
            src="/couple.png"
            alt=""
            aria-hidden
            width={1024}
            height={1024}
            sizes="(max-width: 640px) 128px, 176px"
            className="pointer-events-none h-auto w-28 shrink-0 select-none sm:w-44"
          />
        </section>

        {/* 1. Совместимость */}
        <ReportBlock n={1} title={t.compat.title} note={t.compat.note}>
          <div className="flex items-end justify-between gap-3">
            <p
              className={cn(
                "font-display text-4xl leading-none font-extrabold",
                TONE_TEXT[report.compatTone],
              )}
            >
              {report.compatibility}%
            </p>
            <p className="text-right text-xs font-bold text-ink-soft">
              {t.compat.levels[report.compatTone]}
            </p>
          </div>
          <div className="mt-3">
            <Bar value={report.compatibility} tone={report.compatTone} />
          </div>

          {/* Вывод от модели. Без неё блок просто короче. */}
          {report.summary ? (
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              {report.summary}
            </p>
          ) : null}
        </ReportBlock>

        {/* 2. Портрет пары: архетип, супер-сила и зона риска в карусели */}
        <PortraitCarousel
          n={2}
          slides={[
            {
              title: t.portrait.archetypeTitle,
              name: t.archetypes[report.archetype].name,
              // Текст пишет модель — про эту пару. Описание метки из словаря
              // остаётся запасным: оно одинаковое у всех, кому она досталась.
              text:
                report.portrait.archetype ??
                t.archetypes[report.archetype].text,
              art: ARCHETYPE_ART[report.archetype],
            },
            {
              title: t.portrait.powerTitle,
              name: t.powers[report.power].name,
              text: report.portrait.power ?? t.powers[report.power].text,
              art: POWER_ART[report.power],
            },
            {
              title: t.portrait.riskTitle,
              name: t.riskZones[report.risk].name,
              text: report.portrait.risk ?? t.riskZones[report.risk].text,
              art: RISK_ART[report.risk],
            },
          ]}
          prevLabel={t.portrait.prev}
          nextLabel={t.portrait.next}
          slideLabel={t.portrait.slide}
        />

        {/* 3. Анатомия */}
        <ReportBlock n={3} title={t.anatomy.title} note={t.anatomy.note}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {report.metrics.map((metric) => (
              <Donut
                key={metric.id}
                value={metric.value}
                tone={metric.tone}
                label={dict.anatomy.metrics[metric.id]}
              />
            ))}
          </div>
        </ReportBlock>

        {/* Граница платного: дальше блоки рисуются только из того, что пришло
            с сервера после подтверждённой оплаты. */}
        {locked ? (
          justPaid ? <PaidNote text={pw.done} /> : null
        ) : (
          <PaywallCard
            texts={pw}
            price={access.price}
            status={paywallStatus}
            onPay={() => void pay()}
            onRecheck={() => void recheck()}
          />
        )}

        {/* 4. Вердикт: кто из двоих перегибает с контролем */}
        {locked ? (
          <ReportBlock n={4} title={t.abuser.title}>
            <div className="flex items-center justify-center gap-4 sm:gap-8">
              <Avatar src="/woman.png" label={who.she} tone="she" />
              <span className="font-display text-sm font-extrabold text-ink-muted sm:text-base">
                VS
              </span>
              <Avatar src="/man.png" label={who.he} tone="he" />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <p className="text-[13px] font-bold sm:text-sm">{t.abuser.lead}</p>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-extrabold sm:text-sm",
                  locked.abuser === "nobody"
                    ? "bg-flag-green/10 text-flag-green"
                    : "bg-flag-red/10 text-flag-red",
                )}
              >
                <span aria-hidden>!</span>
                {t.abuser.verdicts[locked.abuser]}
              </span>
            </div>

            <p className="mt-3 rounded-2xl bg-canvas p-3 text-center text-[12px] leading-snug text-ink-soft sm:text-[13px]">
              {locked.abuserNote ?? t.abuser.notes[locked.abuser]}
            </p>
          </ReportBlock>
        ) : (
          <LockedBlock n={4} title={t.abuser.title} shape="faces" texts={pw} />
        )}

        {/* 5. Баттл: перевес по каждому вопросу */}
        {locked ? (
          <ReportBlock n={5} title={t.battle.title}>
            {!locked.hasBattle ? (
              <p className="text-xs text-ink-muted">{t.battle.empty}</p>
            ) : (
              <>
                <div className="flex items-center justify-end gap-4">
                  <SideBadge src="/woman.png" label={who.she} tone="she" />
                  <SideBadge src="/man.png" label={who.he} tone="he" />
                </div>

                <ul className="mt-4 flex flex-col gap-4 sm:gap-5">
                  {locked.battle.map((round) => (
                    <BattleRow
                      key={round.id}
                      label={dict.battle.rounds[round.id]}
                      value={round.value}
                    />
                  ))}
                </ul>
              </>
            )}
          </ReportBlock>
        ) : (
          <LockedBlock n={5} title={t.battle.title} shape="rows" texts={pw} />
        )}

        {/* 6. Флагометр: сколько грин и ред флагов набрал каждый */}
        {locked ? (
          <ReportBlock n={6} title={t.flags.title} note={t.flags.lead}>
            {locked.flags.total.green + locked.flags.total.red === 0 ? (
              <p className="text-xs text-ink-muted">{t.flags.empty}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <FlagColumn
                    src="/woman.png"
                    name={who.she}
                    tone="she"
                    count={locked.flags.she}
                    greenLabel={t.flags.countGreen}
                    redLabel={t.flags.countRed}
                  />
                  <FlagColumn
                    src="/man.png"
                    name={who.he}
                    tone="he"
                    count={locked.flags.he}
                    greenLabel={t.flags.countGreen}
                    redLabel={t.flags.countRed}
                  />
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  <Award
                    label={t.flags.awardGreen}
                    holder={locked.flags.greenHolder}
                    who={who}
                    tie={t.flags.tie}
                    tone="green"
                  />
                  <Award
                    label={t.flags.awardRed}
                    holder={locked.flags.redHolder}
                    who={who}
                    tie={t.flags.tie}
                    tone="red"
                  />
                </div>

                <p className="mt-3 text-center text-[11px] font-bold text-ink-muted sm:text-xs">
                  {t.flags.total
                    .replace("{green}", String(locked.flags.total.green))
                    .replace("{red}", String(locked.flags.total.red))}
                </p>
              </>
            )}
          </ReportBlock>
        ) : (
          <LockedBlock
            n={6}
            title={t.flags.title}
            shape="columns"
            texts={pw}
          />
        )}

        {/* 7. Риски */}
        {locked ? (
          <ReportBlock n={7} title={t.risks.title}>
            <div className="grid grid-cols-2 gap-3">
              <Donut
                value={locked.risks.fight}
                tone={toneOfRisk(locked.risks.fight)}
                label={t.risks.fight}
                size={96}
              />
              <Donut
                value={locked.risks.breakup}
                tone={toneOfRisk(locked.risks.breakup)}
                label={t.risks.breakup}
                size={96}
              />
            </div>
          </ReportBlock>
        ) : (
          <LockedBlock n={7} title={t.risks.title} shape="donuts" texts={pw} />
        )}

        {/* 8. Вероятность измены */}
        {locked ? (
          <ReportBlock n={8} title={dict.report.blocks.cheating.title}>
            <p
              className={cn(
                "font-display text-4xl leading-none font-extrabold",
                TONE_TEXT[locked.cheating.tone],
              )}
            >
              {locked.cheating.value}%
            </p>

            <div className="mt-3">
              <Bar value={locked.cheating.value} tone={locked.cheating.tone} />
            </div>

            {locked.cheating.note ? (
              <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                {locked.cheating.note}
              </p>
            ) : null}
          </ReportBlock>
        ) : (
          <LockedBlock
            n={8}
            title={dict.report.blocks.cheating.title}
            shape="value"
            texts={pw}
          />
        )}

        {/* 9. Идеи для свиданий. Их придумывает модель, поэтому без разбора
            блока нет: подставлять общие советы вместо разбора нечестно. */}
        {locked ? (
          locked.dates.length > 0 ? (
            <ReportBlock n={9} title={dict.report.blocks.dates.title}>
              <ol className="flex flex-col gap-2">
                {locked.dates.map((idea, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2.5 rounded-2xl bg-canvas p-3"
                  >
                    <span
                      aria-hidden
                      className="grid size-5 shrink-0 place-items-center rounded-full bg-pink-100 text-[10px] font-extrabold text-pink-600"
                    >
                      {index + 1}
                    </span>
                    <p className="text-[12px] leading-snug sm:text-[13px]">
                      {idea}
                    </p>
                  </li>
                ))}
              </ol>
            </ReportBlock>
          ) : null
        ) : (
          <LockedBlock
            n={9}
            title={dict.report.blocks.dates.title}
            shape="list"
            texts={pw}
          />
        )}

        {/* 10. Фильм, мем и мультфильм — тоже только с разбором. Номер
            подстраивается, чтобы в отчёте не было пропущенного. */}
        {locked ? (
          locked.fun ? (
            <ReportBlock
              n={locked.dates.length > 0 ? 10 : 9}
              title={dict.report.blocks.fun.title}
            >
              <div className="grid gap-2 sm:grid-cols-3">
                <NoteCard label={t.fun.film} text={locked.fun.film} />
                <NoteCard label={t.fun.meme} text={locked.fun.meme} />
                <NoteCard label={t.fun.cartoon} text={locked.fun.cartoon} />
              </div>
            </ReportBlock>
          ) : null
        ) : (
          <LockedBlock
            n={10}
            title={dict.report.blocks.fun.title}
            shape="list"
            texts={pw}
          />
        )}

        {/* Единственный выход обратно в тест: со заполненными ответами
            страница теста сама возвращает в отчёт, поэтому пройти заново
            можно только сбросив ответы. */}
        <div className="no-print mt-4 flex justify-center">
          <button
            type="button"
            onClick={handleRestart}
            className="shadow-block rounded-full bg-white px-5 py-2 text-xs font-extrabold text-ink-soft transition-colors hover:text-pink-600"
          >
            {dict.quiz.restart}
          </button>
        </div>

        {/* Видно, чем посчитан отчёт: без этого молчаливый сбой нейросети
            выглядит как обычный отчёт. */}
        {report.source === "template" ? (
          <p className="mt-4 text-center text-[11px] font-bold text-ink-muted">
            {t.templateNote}
          </p>
        ) : null}

        <p className="mt-4 text-center text-[10px] leading-snug text-ink-muted sm:text-[11px]">
          {t.disclaimer}
        </p>
      </main>
    </div>
  );
}

/** Аватар участника для блока с вердиктом. */
function Avatar({
  src,
  label,
  tone,
}: {
  src: string;
  label: string;
  tone: "she" | "he";
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Image
        src={src}
        alt=""
        aria-hidden
        width={1024}
        height={1024}
        sizes="(max-width: 640px) 88px, 112px"
        className={cn(
          "size-20 rounded-full object-cover ring-4 sm:size-28",
          tone === "she" ? "ring-pink-100" : "ring-canvas",
        )}
      />
      <span
        className={cn(
          "text-[11px] font-extrabold",
          tone === "she" ? "text-pink-600" : "text-ink-soft",
        )}
      >
        {label}
      </span>
    </div>
  );
}

/** Маленький аватар с подписью: шапка баттла. */
function SideBadge({
  src,
  label,
  tone,
}: {
  src: string;
  label: string;
  tone: "she" | "he";
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Image
        src={src}
        alt=""
        aria-hidden
        width={1024}
        height={1024}
        sizes="32px"
        className="size-7 rounded-full object-cover"
      />
      <span
        className={cn(
          "text-[11px] font-extrabold",
          tone === "she" ? "text-pink-600" : "text-ink-soft",
        )}
      >
        {label}
      </span>
    </span>
  );
}

/**
 * Раунд баттла: дорожка от розового (она) к тёмному (он) и кружок перевеса.
 * Ползунок не интерактивный — это индикатор, поэтому это не input.
 */
function BattleRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center gap-3">
      <p className="min-w-0 flex-1 text-[12px] leading-tight font-bold sm:text-[13px]">
        {label}
      </p>

      <div
        role="img"
        aria-label={`${label} ${value}%`}
        className="relative h-2 w-28 shrink-0 sm:w-40"
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500 to-ink-soft" />
        <span
          aria-hidden
          style={{ left: `${value}%` }}
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-pink-300 bg-white shadow-sm"
        />
      </div>
    </li>
  );
}

/** Колонка одного участника: аватар, имя и два счётчика флагов. */
function FlagColumn({
  src,
  name,
  tone,
  count,
  greenLabel,
  redLabel,
}: {
  src: string;
  name: string;
  tone: "she" | "he";
  count: FlagCount;
  greenLabel: string;
  redLabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Image
        src={src}
        alt=""
        aria-hidden
        width={1024}
        height={1024}
        sizes="(max-width: 640px) 72px, 96px"
        className={cn(
          "size-16 rounded-full object-cover ring-4 sm:size-24",
          tone === "she" ? "ring-pink-100" : "ring-canvas",
        )}
      />
      <span
        className={cn(
          "rounded-full px-3 py-0.5 text-[11px] font-extrabold text-white",
          tone === "she" ? "bg-pink-500" : "bg-ink-soft",
        )}
      >
        {name}
      </span>

      <FlagCard label={greenLabel} value={count.green} tone="green" />
      <FlagCard label={redLabel} value={count.red} tone="red" />
    </div>
  );
}

function FlagCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "red";
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-1 rounded-2xl p-2.5 text-center",
        tone === "green" ? "bg-flag-green/10" : "bg-flag-red/10",
      )}
    >
      <span className="text-[10px] leading-tight font-bold text-balance text-ink-soft sm:text-[11px]">
        {label}
      </span>
      <span
        className={cn(
          "font-display grid size-10 place-items-center rounded-full text-base font-extrabold text-white sm:size-11 sm:text-lg",
          tone === "green" ? "bg-flag-green" : "bg-flag-red",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Строка звания: кому достался грин или ред флаг. */
function Award({
  label,
  holder,
  who,
  tie,
  tone,
}: {
  label: string;
  holder: "she" | "he" | null;
  who: { she: string; he: string };
  tie: string;
  tone: "green" | "red";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl p-2.5",
        tone === "green" ? "bg-flag-green/10" : "bg-flag-red/10",
      )}
    >
      <p className="min-w-0 text-[12px] leading-tight font-bold sm:text-[13px]">
        {label}
      </p>

      {holder === null ? (
        <span className="shrink-0 text-[12px] font-extrabold text-ink-muted">
          {tie}
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-1.5">
          <Image
            src={holder === "she" ? "/woman.png" : "/man.png"}
            alt=""
            aria-hidden
            width={1024}
            height={1024}
            sizes="32px"
            className="size-7 rounded-full object-cover"
          />
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-extrabold text-white",
              holder === "she" ? "bg-pink-500" : "bg-ink-soft",
            )}
          >
            {who[holder]}
          </span>
        </span>
      )}
    </div>
  );
}


