// Спільні перевірки полів запитів за схемами openapi.yaml.

// Формат email: локальна частина, @, домен з крапкою, без пробілів.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// date-time за RFC 3339 з обов'язковим часовим поясом.
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const isEmail = (v) => typeof v === 'string' && EMAIL.test(v);
const isPositiveInt = (v) => Number.isInteger(v) && v >= 1;
const isText = (v, min, max) => typeof v === 'string' && v.length >= min && v.length <= max;
const isDateTime = (v) => typeof v === 'string' && DATE_TIME.test(v) && !Number.isNaN(Date.parse(v));

// Вибирає з тіла лише дозволені поля, які справді передано.
function pick(body, keys) {
  return Object.fromEntries(keys.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
}

// Повідомлення для обов'язкових полів, яких немає.
function missing(fields, keys) {
  return keys.filter((k) => !(k in fields)).map((k) => `${k}: обов'язкове поле`);
}

module.exports = { isEmail, isPositiveInt, isText, isDateTime, pick, missing };
