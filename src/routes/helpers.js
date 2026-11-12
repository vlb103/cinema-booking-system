// Спільні помічники маршрутів.

// Розбір ID зі шляху. Нечисловий ID дає NaN, сервіс поверне 404 NOT_FOUND.
function parseId(value) {
  return /^\d+$/.test(value) ? Number(value) : NaN;
}

// Обробник, який віддає результат сервісу як JSON із заданим кодом.
// Помилки сервісу Express 5 передає в обробник помилок.
function respond(status, handler) {
  return (req, res) => {
    res.status(status).json(handler(req));
  };
}

// Тіло запиту, порожній об'єкт якщо тіла немає.
const bodyOf = (req) => req.body || {};

module.exports = { parseId, respond, bodyOf };
