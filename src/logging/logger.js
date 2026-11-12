// Операційний лог у файл JSON Lines (REQ-LOG-001..REQ-LOG-004). Без паролів і токенів (REQ-LOG-003).
const fs = require('fs');
const path = require('path');
const { STATUSES } = require('./events');
const { systemClock } = require('../clock');

// Ключі, значення яких ніколи не пишуться в лог.
const SENSITIVE_KEY = /pass|token|secret|authorization|cookie/i;
const BEARER = /Bearer\s+\S+/gi;

function maskString(value) {
  return value.replace(BEARER, 'Bearer [REDACTED]');
}

// Глибока копія без конфіденційних ключів, рядки з Bearer-токенами маскуються.
function sanitize(value) {
  if (typeof value === 'string') return maskString(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (!SENSITIVE_KEY.test(key)) out[key] = sanitize(v);
    }
    return out;
  }
  return value;
}

function readLogFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function createLogger({ filePath, clock = systemClock }) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  function log({ event_type, status, user_id = null, entity_ids = {}, reason = null }) {
    if (typeof event_type !== 'string' || event_type.length === 0) {
      throw new TypeError('log: event_type обов\'язковий');
    }
    if (!Object.values(STATUSES).includes(status)) {
      throw new TypeError(`log: недопустимий status ${status}`);
    }
    // У запис потрапляють лише шість полів REQ-LOG-002, зайві поля відкидаються.
    const record = {
      timestamp: clock.now().toISOString(),
      event_type,
      status,
      user_id: user_id == null ? null : user_id,
      entity_ids: sanitize(entity_ids || {}),
      reason: reason == null ? null : maskString(String(reason)),
    };
    fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }

  return { log, readEntries: () => readLogFile(filePath) };
}

module.exports = { createLogger, sanitize, readLogFile };
