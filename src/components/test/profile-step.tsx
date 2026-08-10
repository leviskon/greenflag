"use client";

import { useId, useState } from "react";
import { cn } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/ru";
import type { CoupleProfile } from "@/lib/storage";

type Texts = Dictionary["testForm"];

type Fields = {
  sheName: string;
  sheBirthday: string;
  heName: string;
  heBirthday: string;
  since: string;
  email: string;
};

type Errors = Partial<Record<keyof Fields, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ProfileStep({
  texts,
  header,
  initial,
  onSubmit,
}: {
  texts: Texts;
  /** Заголовок с картинкой: рендерится на сервере. */
  header: React.ReactNode;
  /** Уже сохранённые данные пары — подставляются при возврате назад. */
  initial: CoupleProfile;
  onSubmit: (profile: CoupleProfile) => void;
}) {
  const [fields, setFields] = useState<Fields>(() => ({
    sheName: initial.she.name,
    sheBirthday: initial.she.birthday,
    heName: initial.he.name,
    heBirthday: initial.he.birthday,
    since: initial.since,
    email: initial.email,
  }));
  const [errors, setErrors] = useState<Errors>({});

  function update<K extends keyof Fields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(values: Fields): Errors {
    const next: Errors = {};

    if (!values.sheName.trim()) next.sheName = texts.errors.name;
    if (!values.sheBirthday) next.sheBirthday = texts.errors.birthday;
    if (!values.heName.trim()) next.heName = texts.errors.name;
    if (!values.heBirthday) next.heBirthday = texts.errors.birthday;
    if (!values.since) next.since = texts.errors.since;
    if (!EMAIL_RE.test(values.email.trim())) next.email = texts.errors.email;

    return next;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();

    const found = validate(fields);
    setErrors(found);
    
    if (Object.keys(found).length > 0) {
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    onSubmit({
      she: { name: fields.sheName.trim(), birthday: fields.sheBirthday },
      he: { name: fields.heName.trim(), birthday: fields.heBirthday },
      since: fields.since,
      email: fields.email.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center gap-4 sm:gap-3">
        {header}

        <div className="rounded-block shadow-block bg-white p-3 sm:p-4">
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
                  label={texts.nameLabel}
                  value={fields.sheName}
                  onChange={(v) => update("sheName", v)}
                  placeholder={texts.namePlaceholderShe}
                  error={errors.sheName}
                  autoComplete="off"
                />
                <Field
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
                  label={texts.nameLabel}
                  value={fields.heName}
                  onChange={(v) => update("heName", v)}
                  placeholder={texts.namePlaceholderHe}
                  error={errors.heName}
                  autoComplete="off"
                />
                <Field
                  label={texts.birthdayLabel}
                  type="date"
                  value={fields.heBirthday}
                  onChange={(v) => update("heBirthday", v)}
                  error={errors.heBirthday}
                />
              </div>
            </fieldset>
          </div>

          <div className="mt-2 flex flex-col gap-2 sm:mt-2.5">
            <Field
              label={texts.sinceLabel}
              hint={texts.sinceHint}
              type="month"
              value={fields.since}
              onChange={(v) => update("since", v)}
              error={errors.since}
              tone="soft"
            />
            <Field
              label={texts.emailLabel}
              hint={texts.emailHint}
              type="email"
              inputMode="email"
              value={fields.email}
              onChange={(v) => update("email", v)}
              placeholder={texts.emailPlaceholder}
              error={errors.email}
              autoComplete="email"
              tone="soft"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:mt-3">
        <button
          type="submit"
          className="shadow-pill w-full rounded-full bg-pink-500 px-6 py-3 text-[15px] font-extrabold whitespace-nowrap text-white transition-colors hover:bg-pink-600 active:translate-y-px"
        >
          {texts.submit}
        </button>

        <p className="text-center text-[10px] leading-snug text-ink-muted sm:text-xs">
          {texts.legalBefore} <LegalLink>{texts.legalOffer}</LegalLink>,{" "}
          <LegalLink>{texts.legalTerms}</LegalLink> {texts.legalAnd}{" "}
          <LegalLink>{texts.legalPrivacy}</LegalLink>
        </p>
      </div>
    </form>
  );
}

function LegalLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      href="#"
      className="text-pink-600 underline decoration-dashed underline-offset-2"
    >
      {children}
    </a>
  );
}

/** Лейбл внутри поля: компактнее и повторяет исходный макет. */
function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  autoComplete,
  inputMode,
  tone = "plain",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date" | "month" | "email";
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  inputMode?: "email" | "text";
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
        type={type}
        inputMode={inputMode}
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
