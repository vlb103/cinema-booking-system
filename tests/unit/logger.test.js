// Раунд 1. Модуль операційного логу (src/logging/logger.js).
// Джерела: SRS REQ-LOG-002 (склад полів), REQ-LOG-003 (без паролів і токенів),
// REQ-LOG-004 (персистентність після перезапуску), тікети T-60, T-62, T-64.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createLogger, readLogFile } = require('../../src/logging/logger');
const { createFakeClock } = require('../helpers/clock');

const NOW = '2026-11-12T12:00:00.000Z';
const REQUIRED_FIELDS = ['timestamp', 'event_type', 'status', 'user_id', 'entity_ids', 'reason'];
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

function tempLogPath(sub = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbs-logger-'));
  return path.join(dir, sub, 'app.log');
}

function b64Variants(value) {
  const b64 = Buffer.from(value).toString('base64');
  return [b64, b64.replace(/=+$/, ''), Buffer.from(value).toString('base64url')];
}

describe('logger, структура запису (REQ-LOG-002)', () => {
  test('[REQ-LOG-002][T-60] запис містить усі шість обов\'язкових полів', () => {
    const filePath = tempLogPath();
    const logger = createLogger({ filePath, clock: createFakeClock(NOW) });

    logger.log({ event_type: 'BOOKING_CREATED', status: 'SUCCESS', user_id: 15, entity_ids: { sessionId: 10, bookingId: 42 }, reason: null });

    const [entry] = readLogFile(filePath);
    for (const field of REQUIRED_FIELDS) expect(entry).toHaveProperty(field);
    expect(entry).toMatchObject({ event_type: 'BOOKING_CREATED', status: 'SUCCESS', user_id: 15, entity_ids: { sessionId: 10, bookingId: 42 } });
  });

  test('[REQ-LOG-002][T-60] timestamp у форматі ISO-8601 UTC і береться з годинника', () => {
    const filePath = tempLogPath();
    const logger = createLogger({ filePath, clock: createFakeClock(NOW) });

    logger.log({ event_type: 'USER_LOGIN', status: 'SUCCESS', user_id: 1, entity_ids: {} });

    const [entry] = readLogFile(filePath);
    expect(entry.timestamp).toMatch(ISO_UTC);
    expect(entry.timestamp).toBe(NOW);
  });

  test('[REQ-LOG-002] якщо суб\'єкт не ідентифікований, user_id дорівнює null, а відсутні entity_ids і reason мають значення за замовчуванням', () => {
    const filePath = tempLogPath();
    const logger = createLogger({ filePath, clock: createFakeClock(NOW) });

    logger.log({ event_type: 'ACCESS_DENIED', status: 'REJECTED', reason: 'Потрібна автентифікація' });

    const [entry] = readLogFile(filePath);
    expect(entry.user_id).toBeNull();
    expect(entry.entity_ids).toEqual({});
    expect(entry.reason).toBe('Потрібна автентифікація');
  });

  test.each(['SUCCESS', 'REJECTED', 'ERROR'])('[REQ-LOG-002] status %s приймається', (status) => {
    const filePath = tempLogPath();
    const logger = createLogger({ filePath, clock: createFakeClock(NOW) });

    logger.log({ event_type: 'SYSTEM_ERROR', status, user_id: null, entity_ids: {}, reason: 'x' });

    expect(readLogFile(filePath)[0].status).toBe(status);
  });

  test.each([
    ['невідомий status', { event_type: 'USER_LOGIN', status: 'OK' }],
    ['без status', { event_type: 'USER_LOGIN' }],
    ['без event_type', { status: 'SUCCESS' }],
  ])('[REQ-LOG-002] запис з помилкою структури (%s) відхиляється', (_name, entry) => {
    const filePath = tempLogPath();
    const logger = createLogger({ filePath, clock: createFakeClock(NOW) });

    expect(() => logger.log(entry)).toThrow();
    expect(readLogFile(filePath)).toEqual([]);
  });

  test('[REQ-LOG-002] кожен запис займає окремий рядок JSON', () => {
    const filePath = tempLogPath();
    const logger = createLogger({ filePath, clock: createFakeClock(NOW) });

    logger.log({ event_type: 'USER_REGISTERED', status: 'SUCCESS', user_id: 1, entity_ids: { userId: 1 } });
    logger.log({ event_type: 'USER_LOGIN', status: 'SUCCESS', user_id: 1, entity_ids: { userId: 1 } });

    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter((l) => l.trim());
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(() => JSON.parse(l)).not.toThrow();
  });
});

describe('logger, конфіденційні дані (REQ-LOG-003)', () => {
  test('[REQ-LOG-003][T-62] паролі і токени в entity_ids і в зайвих полях не потрапляють у файл', () => {
    const filePath = tempLogPath();
    const logger = createLogger({ filePath, clock: createFakeClock(NOW) });

    logger.log({
      event_type: 'USER_LOGIN',
      status: 'SUCCESS',
      user_id: 7,
      entity_ids: { userId: 7, password: 'secret123', accessToken: 'tok-aaa111', nested: { token: 'tok-bbb222' } },
      password: 'secret123',
      authorization: 'Bearer tok-ccc333',
    });

    const raw = fs.readFileSync(filePath, 'utf8');
    for (const secret of ['secret123', 'tok-aaa111', 'tok-bbb222', 'tok-ccc333']) {
      expect(raw).not.toContain(secret);
      for (const enc of b64Variants(secret)) expect(raw).not.toContain(enc);
    }
    expect(readLogFile(filePath)[0].entity_ids.userId).toBe(7);
  });

  test('[REQ-LOG-003][T-62] Bearer-токен у тексті reason маскується', () => {
    const filePath = tempLogPath();
    const logger = createLogger({ filePath, clock: createFakeClock(NOW) });

    logger.log({ event_type: 'ACCESS_DENIED', status: 'REJECTED', reason: 'Недійсний заголовок Authorization: Bearer eyJhbGciOi.payload.sig' });

    const raw = fs.readFileSync(filePath, 'utf8');
    expect(raw).not.toContain('eyJhbGciOi.payload.sig');
    expect(readLogFile(filePath)[0].reason).toContain('Недійсний заголовок');
  });
});

describe('logger, персистентність (REQ-LOG-004)', () => {
  test('[REQ-LOG-004][T-64] записи попереднього запуску доступні після перезапуску, новий запуск дописує, а не перезаписує', () => {
    const filePath = tempLogPath();
    const first = createLogger({ filePath, clock: createFakeClock(NOW) });
    first.log({ event_type: 'USER_REGISTERED', status: 'SUCCESS', user_id: 1, entity_ids: { userId: 1 } });
    first.log({ event_type: 'USER_LOGIN', status: 'SUCCESS', user_id: 1, entity_ids: { userId: 1 } });

    const second = createLogger({ filePath, clock: createFakeClock('2026-11-13T09:00:00.000Z') });
    second.log({ event_type: 'USER_LOGIN', status: 'REJECTED', user_id: null, entity_ids: {}, reason: 'Невірний пароль' });

    const entries = readLogFile(filePath);
    expect(entries.map((e) => e.event_type)).toEqual(['USER_REGISTERED', 'USER_LOGIN', 'USER_LOGIN']);
    expect(entries[0].timestamp).toBe(NOW);
    expect(entries[2].timestamp).toBe('2026-11-13T09:00:00.000Z');
  });

  test('[REQ-LOG-004] каталог для файлу логу створюється, якщо його немає', () => {
    const filePath = tempLogPath(path.join('nested', 'dir'));
    const logger = createLogger({ filePath, clock: createFakeClock(NOW) });

    logger.log({ event_type: 'USER_LOGIN', status: 'SUCCESS', user_id: 1, entity_ids: {} });

    expect(fs.existsSync(filePath)).toBe(true);
  });

  test('[REQ-LOG-004] читання відсутнього файлу логу повертає порожній список', () => {
    expect(readLogFile(tempLogPath())).toEqual([]);
  });
});
