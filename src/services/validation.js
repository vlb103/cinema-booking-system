// Перевірки полів запитів за схемами openapi.yaml.

// Формат email: локальна частина, @, домен з крапкою, без пробілів.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmail(value) {
  return typeof value === 'string' && EMAIL.test(value);
}

module.exports = { isEmail };
