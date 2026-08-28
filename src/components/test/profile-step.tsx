"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/components/ui";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/ru";
import type { LegalDoc } from "@/lib/legal";
import {
  readProfileDraft,
  saveProfileDraft,
  type CoupleProfile,
} from "@/lib/storage";

type Texts = Dictionary["testForm"];

type Fields = {
  sheName: string;
  sheBirthday: string;
  heName: string;
  heBirthday: string;
  since: string;
};

type Errors = Partial<Record<keyof Fields, string>>;

const FIELD_KEYS = [
  "sheName",
  "sheBirthday",
  "heName",
  "heBirthday",
  "since",
] as const;

function toFields(profile: CoupleProfile): Fields {
  return {
    sheName: profile.she.name,
    sheBirthday: profile.she.birthday,
    heName: profile.he.name,
    heBirthday: profile.he.birthday,
    since: profile.since,
  };
}

/** Что сейчас реально введено в поля формы. null — формы ещё нет в DOM. */
function readDomFields(form: HTMLFormElement | null): Fields | null {
  if (!form) return null;

  const data = new FormData(form);
  const fields = {} as Fields;

  for (const key of FIELD_KEYS) {
    const value = data.get(key);
    fields[key] = typeof value === "string" ? value : "";
  }

  return fields;
}

function toProfile(fields: Fields): CoupleProfile {
  return {
    she: { name: fields.sheName.trim(), birthday: fields.sheBirthday },
    he: { name: fields.heName.trim(), birthday: fields.heBirthday },
    since: fields.since,
  };
}

export function ProfileStep({
  texts,
  locale,
  header,
  initial,
  onSubmit,
}: {
  texts: Texts;
  /** Нужен для ссылок на правовые страницы. */
  locale: Locale;
  /** Заголовок с картинкой: рендерится на сервере. */
  header: React.ReactNode;
  /** Уже сохранённые данные пары — подставляются при возврате назад. */
  initial: CoupleProfile;
  onSubmit: (profile: CoupleProfile) => void;
}) {
  const [fields, setFields] = useState<Fields>(() => toFields(initial));
  const [errors, setErrors] = useState<Errors>({});
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * Страница отдаётся с сервера уже готовой, поэтому на телефоне в поля можно
   * начать печатать раньше, чем загрузится и запустится JS: на медленной сети
   * это десятки секунд. React о таком вводе не знает и при первом своём рендере
   * затирает поля пустым состоянием. Поэтому после гидрации забираем то, что
   * реально лежит в DOM, и подхватываем черновик прошлой попытки.
   */
  useEffect(() => {
    const typed = readDomFields(formRef.current);
    const draft = readProfileDraft();

    if (!typed && !draft) return;

    setFields((prev) => {
      const fromDraft = draft ? toFields(draft) : null;
      const next = { ...prev };

      for (const key of FIELD_KEYS) {
        if (typed && typed[key] !== "") next[key] = typed[key];
        else if (next[key] === "" && fromDraft) next[key] = fromDraft[key];
      }

      return next;
    });
  }, []);

  function update<K extends keyof Fields>(key: K, value: string) {
    const next = { ...fields, [key]: value };

    setFields(next);
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    // Черновик переживает перезагрузку страницы: ничего вводить заново не нужно.
    saveProfileDraft(toProfile(next));
  }

  function validate(values: Fields): Errors {
    const next: Errors = {};

    if (!values.sheName.trim()) next.sheName = texts.errors.name;
    if (!values.sheBirthday) next.sheBirthday = texts.errors.birthday;
    if (!values.heName.trim()) next.heName = texts.errors.name;
    if (!values.heBirthday) next.heBirthday = texts.errors.birthday;
    if (!values.since) next.since = texts.errors.since;

    return next;
  }

  function submit() {
    // Источник правды — сами поля в DOM, а не состояние React: пользователь мог
    // печатать до гидрации или браузер мог подставить автозаполнение.
    const values = readDomFields(formRef.current) ?? fields;

    setFields(values);

    const found = validate(values);
    setErrors(found);

    if (Object.keys(found).length > 0) return;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const profile = toProfile(values);
    saveProfileDraft(profile);
    onSubmit(profile);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Своя отправка: браузеру форму отдавать нельзя, иначе он перезагрузит
    // страницу и всё введённое пропадёт.
    event.preventDefault();
    event.stopPropagation();
    submit();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    // У формы нет кнопки submit, поэтому Enter обрабатываем сами.
    if (event.key !== "Enter" || event.shiftKey) return;
    if (!(event.target instanceof HTMLInputElement)) return;

    event.preventDefault();
    submit();
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      noValidate
      className="flex flex-1 flex-col"
    >
      <div className="flex flex-1 flex-col justify-center gap-4 sm:gap-3">
        <div key="header-wrapper">{header}</div>

        <div key="form-card" className="rounded-block shadow-block bg-white p-3 sm:p-4">
          <h2 className="text-center text-[13px] font-extrabold sm:text-[15px]">
            {texts.cardTitle}
          </h2>

          {/* Две колонки и на телефоне — как в исходном макете. */}
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:gap-2.5">
            <fieldset className="rounded-2xl bg-pink-50 p-2 sm:p-2.5">
              <legend className="px-1 text-center text-xs font-extrabold text-pink-600 sm:text-sm">
                {texts.she}
              </legend>
              <div className="flex flex-col gap-2">
                <Field
                  name="sheName"
                  label={texts.nameLabel}
                  value={fields.sheName}
                  onChange={(v) => update("sheName", v)}
                  placeholder={texts.namePlaceholderShe}
                  error={errors.sheName}
                  autoComplete="off"
                />
                <Field
                  name="sheBirthday"
                  label={texts.birthdayLabel}
                  type="date"
                  value={fields.sheBirthday}
                  onChange={(v) => update("sheBirthday", v)}
                  error={errors.sheBirthday}
                />
              </div>
            </fieldset>

            <fieldset className="rounded-2xl bg-canvas p-2 sm:p-2.5">
              <legend className="px-1 text-center text-xs font-extrabold text-ink-soft sm:text-sm">
                {texts.he}
              </legend>
              <div className="flex flex-col gap-2">
                <Field
                  name="heName"
                  label={texts.nameLabel}
                  value={fields.heName}
                  onChange={(v) => update("heName", v)}
                  placeholder={texts.namePlaceholderHe}
                  error={errors.heName}
                  autoComplete="off"
                />
                <Field
                  name="heBirthday"
                  label={texts.birthdayLabel}
                  type="date"
                  value={fields.heBirthday}
                  onChange={(v) => update("heBirthday", v)}
                  error={errors.heBirthday}
                />
              </div>
            </fieldset>
          </div>

          {/* Поле e-mail убрано: отчёт никуда не отправляется, пара видит его
              сразу после теста. */}
          <div className="mt-2 flex flex-col gap-2 sm:mt-2.5">
            <Field
              name="since"
              label={texts.sinceLabel}
              hint={texts.sinceHint}
              type="month"
              value={fields.since}
              onChange={(v) => update("since", v)}
              error={errors.since}
              tone="soft"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:mt-3">
        {/* Не submit: у формы не должно быть кнопки отправки, иначе браузер
            может отправить её сам, ещё до того как заработает JS. */}
        <button
          type="button"
          onClick={submit}
          className="shadow-pill w-full rounded-full bg-pink-500 px-6 py-3 text-[15px] font-extrabold whitespace-nowrap text-white transition-colors hover:bg-pink-600 active:translate-y-px"
        >
          {texts.submit}
        </button>

        {/* Ссылки открываются в новой вкладке: заполненная форма и черновик
            остаются на месте, читать документ можно не теряя ввод. */}
        <p className="text-center text-[10px] leading-snug text-ink-muted sm:text-xs">
          {texts.legalBefore}{" "}
          <LegalLink locale={locale} doc="offer">
            {texts.legalOffer}
          </LegalLink>
          ,{" "}
          <LegalLink locale={locale} doc="terms">
            {texts.legalTerms}
          </LegalLink>{" "}
          {texts.legalAnd}{" "}
          <LegalLink locale={locale} doc="privacy">
            {texts.legalPrivacy}
          </LegalLink>
        </p>
      </div>
    </form>
  );
}

function LegalLink({
  locale,
  doc,
  children,
}: {
  locale: Locale;
  doc: LegalDoc;
  children: React.ReactNode;
}) {
  return (
    <a
      href={`/${locale}/legal/${doc}`}
      target="_blank"
      rel="noopener"
      className="text-pink-600 underline decoration-dashed underline-offset-2"
    >
      {children}
    </a>
  );
}

/** Лейбл внутри поля: компактнее и повторяет исходный макет. */
function Field({
  name,
  label,
  hint,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  autoComplete,
  tone = "plain",
}: {
  /** Совпадает с ключом в Fields: по нему читаем ввод до гидрации. */
  name: keyof Fields;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date" | "month";
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  tone?: "plain" | "soft";
}) {
  const id = useId();

  return (
    <div
      className={cn(
        "rounded-2xl px-3 py-1.5",
        tone === "soft" ? "bg-canvas" : "bg-white",
        error ? "ring-2 ring-flag-red" : "shadow-block",
      )}
    >
      <label
        htmlFor={id}
        className="block text-[10px] leading-tight font-bold text-ink-soft sm:text-[11px]"
      >
        {label}
        {hint ? (
          <span className="ml-1 font-medium text-ink-muted italic">
            ({hint})
          </span>
        ) : null}
      </label>

      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="w-full min-w-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-muted/70 sm:text-sm"
      />

      {error ? (
        <span
          id={`${id}-error`}
          className="block text-[10px] font-bold text-flag-red"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
