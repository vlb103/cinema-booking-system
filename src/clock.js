// Джерело поточного часу. У тестах підміняється фіктивним годинником (tests/helpers/clock.js).
const systemClock = {
  now: () => new Date(),
};

// Поточний час у форматі ISO-8601 UTC, у якому він зберігається в БД і лозі.
function isoNow(clock) {
  return clock.now().toISOString();
}

module.exports = { systemClock, isoNow };
