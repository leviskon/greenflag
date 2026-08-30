/**
 * Сборка промпта. Задача — дать модели ровно то, что нужно для решения, и
 * ничего лишнего: каждый лишний абзац здесь оплачивается на каждом отчёте.
 *
 * Экономия построена на трёх приёмах:
 * 1. Метки нумерованы — в ответе приходит номер, а не длинный id.
 * 2. Числа приходят объектом с осмысленными ключами: ключ дороже номера, зато
 *    перепутать местами метрики невозможно.
 * 3. Черновые оценки по формулам идут в промпт как ориентир, поэтому модели не
 *    нужно объяснять шкалы словами, а нам — надеяться на её фантазию.
 */

import {
  ARCHETYPE_IDS,
  ARCHETYPE_MATCH,
  POWER_IDS,
  POWER_RISK_CONFLICTS,
  RISK_IDS,
} from "@/lib/content";
import { ru, type Dictionary } from "@/lib/i18n/ru";
import type { Locale } from "@/lib/i18n/config";
import type { Report } from "@/lib/report";
import type { TestState } from "@/lib/storage";
import { BATTLE_KEYS, METRIC_KEYS } from "./analysis";

type Quiz = Dictionary["quiz"];
type Question = Quiz["questions"][number];

/** Сколько символов свободного ответа отправляем. Дальше — обрезка. */
const MAX_ANSWER = 400;

const LANGUAGE_NAME: Record<Locale, string> = {
  ru: "русском",
  ky: "кыргызском",
};

/**
 * «1 match-gasoline (Спичка и бензин) — описание» — номер для ответа, id и
 * название для смысла, описание из словаря для точности.
 *
 * Описания стоят входных токенов, но без них модель выбирала метку по одному
 * названию и писать о ней ничего не могла: текст в отчёте оставался общим для
 * всех пар с этой меткой.
 */
function catalogue(
  ids: readonly string[],
  entries: Record<string, { name: string; text: string }>,
): string {
  return ids
    .map(
      (id, index) =>
        `${index + 1} ${id} (${entries[id].name}) — ${entries[id].text}`,
    )
    .join("\n");
}

/** Матрица сочетаний в номерах: «1: p 1,6,10 | r 1,6». */
function matrix(): string {
  return ARCHETYPE_IDS.map((archetype, index) => {
    const match = ARCHETYPE_MATCH[archetype];
    const powers = match.powers.map((id) => POWER_IDS.indexOf(id) + 1);
    const risks = match.risks.map((id) => RISK_IDS.indexOf(id) + 1);

    return `${index + 1}: p ${powers.join(",")} | r ${risks.join(",")}`;
  }).join("\n");
}

/**
 * Взаимоисключающие пары в номерах: «4: 4» — сила 4 несовместима с риском 4.
 *
 * Сервер такую пару всё равно не пропустит и заменит риск на посчитанный
 * формулой, но лучше, чтобы модель сразу выбрала осмысленный: своё решение она
 * объясняет ответами, а формула — только числами.
 */
function conflicts(): string {
  return POWER_IDS.flatMap((power, index) =>
    POWER_RISK_CONFLICTS[power].map(
      (risk) => `p${index + 1}+r${RISK_IDS.indexOf(risk) + 1}`,
    ),
  ).join(", ");
}

export function buildSystemPrompt(locale: Locale): string {
  const texts = ru.reportPage;

  return `Ты аналитик пары в приложении GreenFlag. По ответам двоих ты выбираешь метки из готовых списков и оцениваешь пару числами.

Ответ — один объект JSON, без markdown, без пояснений до и после. Схема:
{"a":N,"p":N,"r":N,"c":N,"m":{${METRIC_KEYS.map((key) => `"${key}":N`).join(",")}},"b":{${BATTLE_KEYS.map((key) => `"${key}":N`).join(",")}},"ab":"nobody|she|he|both","f":N,"ch":N,"s":"...","an":"...","chn":"...","at":"...","pt":"...","rt":"...","d":["...","...","...","...","..."],"fu":{"film":"...","meme":"...","cartoon":"..."}}

a — номер архетипа, p — номер супер-силы, r — номер зоны риска.
c — совместимость пары. f — вероятность крупной ссоры в ближайшее время.
ch — вероятность измены в этой паре.
Все N — целые числа от 5 до 99. Все ключи в m и b обязательны.

m — метрики пары:
trust доверие, values совпадение ценностей, humor сходство юмора, sex сексуальная совместимость, self возможность быть собой — больше значит лучше.
irritation накопленное раздражение, toxicity токсичность — больше значит хуже.

b — перевес в паре: 0 целиком она, 50 ровно поровну, 100 целиком он.
love кто сильнее любит, boss кто главный, understand кто лучше понимает партнёра, boring кто душнила, toxic кто токсичнее, wise кто мудрее, manipulator кто манипулятор, codependent кто созависимее.

ab — кто перегибает с контролем: nobody, she, he или both.
s — вывод о паре, до 180 символов. an — объяснение вердикта ab, до 140 символов.
chn — чем объясняется ch: что в ответах на это указывает, до 140 символов.
at, pt, rt — текст к выбранному архетипу (a), силе (p) и риску (r), каждый до 200 символов. Обращайся к паре на «вы».
d — ровно пять идей для свиданий, придуманных под эту пару, каждая до 90 символов, без нумерации.
fu — на что пара похожа со стороны: film фильм, meme мем, cartoon мультфильм. В каждом название и коротко почему это они, до 90 символов.
Все тексты — s, an, chn, at, pt, rt, d, fu — на ${LANGUAGE_NAME[locale]} языке, живым тоном, без кавычек, эмодзи и переносов строк.

Архетипы:
${catalogue(ARCHETYPE_IDS, texts.archetypes)}

Супер-силы:
${catalogue(POWER_IDS, texts.powers)}

Зоны риска:
${catalogue(RISK_IDS, texts.riskZones)}

Сочетания (архетип: допустимые силы | допустимые риски):
${matrix()}

Запрещённые пары «сила + риск» — они противоречат друг другу: ${conflicts()}

Правила:
- p выбирай только из списка сил своего a, r — только из списка рисков своего a.
- Пара «сила + риск» не должна противоречить себе: сила — то, что у пары действительно работает.
- Метки должны опираться на ответы, а не на красоту формулировки.
- Числа выводи из ответов: слабые ответы — низкие оценки, тревожные — высокие irritation и toxicity.
- Черновые оценки в конце запроса посчитаны формулами. Это ориентир: меняй их, если ответы говорят другое, и не переписывай без причины.
- at, pt и rt пиши про эту пару и её ответы. Описания в списках даны, чтобы ты понимал смысл метки, — пересказывать их нельзя: пара должна узнать в тексте себя, а не прочитать определение.
- Идеи в d и названия в fu опирай на ответы этой пары, а не на общие советы: они должны узнать себя.
- Тексты укладывай в лимит и заканчивай точкой, обрывать фразу нельзя.
- Ничего, кроме JSON, не выводи.`;
}

function isType(question: Question, type: string): boolean {
  return "type" in question && question.type === type;
}

function short(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();

  return clean.length > MAX_ANSWER ? `${clean.slice(0, MAX_ANSWER)}…` : clean;
}

/** «3,7,1» → [3, 7, 1]; пустой слот — null. */
function parts(value: string): (string | null)[] {
  return value.split(",").map((item) => {
    const token = item.trim();
    return token === "" ? null : token;
  });
}

function choiceLine(question: Question, value: string): string {
  if (!isType(question, "multiple-choice")) return "";

  const options = (question as Extract<Question, { type: "multiple-choice" }>)
    .options;

  const picked = parts(value)
    .map((item) => (item === null ? null : options[Number(item)]))
    .filter((item): item is string => Boolean(item));

  return picked.length === 0 ? "—" : picked.join("; ");
}

function scaleBlock(
  question: Extract<Question, { type: "scale" }>,
  she: string,
  he: string,
): string {
  const sheValues = parts(she);
  const heValues = parts(he);

  return question.pairs
    .map((pair, index) => {
      const left = sheValues[index] ?? "?";
      const right = heValues[index] ?? "?";

      return `${pair.left} ↔ ${pair.right}: она ${left}, он ${right}`;
    })
    .join("\n");
}

function verdictBlock(
  question: Extract<Question, { type: "verdict" }>,
  she: string,
  he: string,
): string {
  const label = (value: string | null) =>
    value === "ok" ? "норм" : value === "bad" ? "стрем" : "?";

  const sheValues = parts(she);
  const heValues = parts(he);

  return question.statements
    .map(
      (statement, index) =>
        `${statement}: она ${label(sheValues[index])}, он ${label(heValues[index])}`,
    )
    .join("\n");
}

/** Черновые оценки одной строкой: ориентир для модели. */
function baselineLine(baseline: Report): string {
  const metrics = baseline.metrics
    .map((metric) => `${metric.id} ${metric.value}`)
    .join(" ");

  return `c ${baseline.compatibility} ${metrics} f ${baseline.risks.fight} ab ${baseline.abuser}`;
}

export function buildUserPrompt(
  state: TestState,
  quiz: Quiz,
  baseline: Report,
): string {
  const she = state.profile.she.name.trim() || "она";
  const he = state.profile.he.name.trim() || "он";

  const lines: string[] = [`Пара: ${she} (она) и ${he} (он).`];

  const open: string[] = [];
  const blocks: string[] = [];

  for (const question of quiz.questions) {
    const answer = state.answers[question.id];
    if (!answer) continue;

    if (isType(question, "scale")) {
      blocks.push(
        `Шкала «или — или», позиции 1…7 (1 — левый вариант, 7 — правый):\n${scaleBlock(
          question as Extract<Question, { type: "scale" }>,
          answer.she,
          answer.he,
        )}`,
      );
      continue;
    }

    if (isType(question, "verdict")) {
      blocks.push(
        `Блиц-опрос:\n${verdictBlock(
          question as Extract<Question, { type: "verdict" }>,
          answer.she,
          answer.he,
        )}`,
      );
      continue;
    }

    if (isType(question, "multiple-choice")) {
      blocks.push(
        `${question.text}\nона: ${choiceLine(question, answer.she)}\nон: ${choiceLine(
          question,
          answer.he,
        )}`,
      );
      continue;
    }

    open.push(
      `${question.text}\nона: ${short(answer.she)}\nон: ${short(answer.he)}`,
    );
  }

  if (open.length > 0) lines.push(`\nОткрытые ответы:\n${open.join("\n\n")}`);
  if (blocks.length > 0) lines.push(`\n${blocks.join("\n\n")}`);

  lines.push(`\nЧерновые оценки: ${baselineLine(baseline)}`);

  return lines.join("\n");
}
