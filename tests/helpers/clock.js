// Фіктивний годинник для тестів, залежних від часу (ADD-12, REQ-F-012).
function createFakeClock(initial) {
  let current = new Date(initial).getTime();
  return {
    now: () => new Date(current),
    set: (value) => { current = new Date(value).getTime(); },
    advance: (ms) => { current += ms; },
  };
}

module.exports = { createFakeClock };
