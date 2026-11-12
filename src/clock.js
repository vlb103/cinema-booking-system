// Джерело поточного часу. У тестах підміняється фіктивним годинником (tests/helpers/clock.js).
const systemClock = {
  now: () => new Date(),
};

module.exports = { systemClock };
