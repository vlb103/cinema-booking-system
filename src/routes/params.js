// Розбір ID зі шляху. Нечисловий ID дає NaN, сервіс поверне 404 NOT_FOUND.
function parseId(value) {
  return /^\d+$/.test(value) ? Number(value) : NaN;
}

module.exports = { parseId };
