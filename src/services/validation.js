// Спільні перевірки полів запитів за схемами openapi.yaml.

// Формат email: локальна частина, @, домен з крапкою, без пробілів.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// date-time за RFC 3339 з обов'язковим часовим поясом.
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
// Календарна дата YYYY-MM-DD (OpenAPI format: date).
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Додатне ціле число, записане рядком, без нулів попереду, знаків і дробової частини.
const POSITIVE_INT_STRING = /^[1-9]\d*$/;

const isEmail = (v) => typeof v === 'string' && EMAIL.test(v);
const isPositiveInt = (v) => Number.isInteger(v) && v >= 1;
const isText = (v, min, max) => typeof v === 'string' && v.length >= min && v.length <= max;
const isDateTime = (v) => typeof v === 'string' && DATE_TIME.test(v) && !Number.isNaN(Date.parse(v));
const isPositiveIntString = (v) => typeof v === 'string' && POSITIVE_INT_STRING.test(v);

// Дата YYYY-MM-DD, яка справді існує. Неіснуючу дату (2026-02-29, 2026-11-31) Date або не розбирає,
// або переносить на інший день, тому розібрана дата має збігтися з рядком.
function isCalendarDate(v) {
  if (typeof v !== 'string' || !DATE.test(v)) return false;
  const parsed = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(v);
}

// Вибирає з тіла лише дозволені поля, які справді передано.
function pick(body, keys) {
  return Object.fromEntries(keys.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
}

// Повідомлення для обов'язкових полів, яких немає.
function missing(fields, keys) {
  return keys.filter((k) => !(k in fields)).map((k) => `${k}: обов'язкове поле`);
}

module.exports = { isEmail, isPositiveInt, isPositiveIntString, isText, isDateTime, isCalendarDate, pick, missing };
