// Раунд 1. Логування дій через API.
// Джерела: SRS REQ-LOG-001 (п.4 відмови, п.5 системні збої), REQ-LOG-002, REQ-LOG-003, REQ-LOG-004,
// сценарій N-33, тікети T-58, T-60, T-62, T-64, T-70.
// Події бронювань і змін адміністратора (REQ-LOG-001 п.1–3) перевіряються в раундах бронювань і адміністрування.
const request = require('supertest');
const { API, TEST_ADMIN, createTestContext } = require('../helpers/testContext');
const { register, login, registerAndLogin, loginAs, uniqueEmail } = require('../helpers/api');

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

function b64Variants(value) {
  const b64 = Buffer.from(value).toString('base64');
  return [b64, b64.replace(/=+$/, ''), Buffer.from(value).toString('base64url')];
}

function findEvent(entries, eventType, status) {
  return entries.filter((e) => e.event_type === eventType && e.status === status);
}

describe('REQ-LOG-001, які дії потрапляють у лог', () => {
  test('[REQ-LOG-001][T-58] успішна реєстрація записується як USER_REGISTERED SUCCESS з ID користувача', async () => {
    const ctx = createTestContext();

    const res = await register(ctx.app, { email: uniqueEmail(), password: 'secret123' });

    const events = findEvent(ctx.readLog(), 'USER_REGISTERED', 'SUCCESS');
    expect(events).toHaveLength(1);
    expect(events[0].user_id).toBe(res.body.id);
    expect(events[0].entity_ids).toMatchObject({ userId: res.body.id });
  });

  test('[REQ-LOG-001][T-58] відмова в реєстрації (зайнятий email) записується як REJECTED з причиною', async () => {
    const ctx = createTestContext();
    const email = uniqueEmail();
    await register(ctx.app, { email, password: 'secret123' });

    await register(ctx.app, { email, password: 'secret123' });

    const events = findEvent(ctx.readLog(), 'USER_REGISTERED', 'REJECTED');
    expect(events).toHaveLength(1);
    expect(typeof events[0].reason).toBe('string');
    expect(events[0].reason.length).toBeGreaterThan(0);
  });

  test('[REQ-LOG-001][T-58] відмова в реєстрації через помилку валідації записується як REJECTED', async () => {
    const ctx = createTestContext();

    await register(ctx.app, { email: 'not-an-email', password: 'secret123' });

    expect(findEvent(ctx.readLog(), 'USER_REGISTERED', 'REJECTED')).toHaveLength(1);
  });

  test('[REQ-LOG-001][T-58] успішний вхід записується як USER_LOGIN SUCCESS з ID користувача', async () => {
    const ctx = createTestContext();
    const user = await registerAndLogin(ctx.app);

    const events = findEvent(ctx.readLog(), 'USER_LOGIN', 'SUCCESS');
    expect(events).toHaveLength(1);
    expect(events[0].user_id).toBe(user.id);
  });

  test('[REQ-LOG-001][T-58] невдалий вхід записується як USER_LOGIN REJECTED без ID і з причиною', async () => {
    const ctx = createTestContext();
    const email = uniqueEmail();
    await register(ctx.app, { email, password: 'secret123' });

    await login(ctx.app, { email, password: 'wrongpass' });

    const events = findEvent(ctx.readLog(), 'USER_LOGIN', 'REJECTED');
    expect(events).toHaveLength(1);
    expect(events[0].user_id).toBeNull();
    expect(events[0].reason).toEqual(expect.any(String));
  });

  test('[REQ-LOG-001][T-58][REQ-F-006] відмова USER в адмін-операції записується як ACCESS_DENIED REJECTED з ID користувача', async () => {
    const ctx = createTestContext();
    const user = await registerAndLogin(ctx.app);

    await request(ctx.app).post(`${API}/admin/films`).set('Authorization', `Bearer ${user.token}`).send({ title: 'X', durationMinutes: 90 });

    const events = findEvent(ctx.readLog(), 'ACCESS_DENIED', 'REJECTED');
    expect(events).toHaveLength(1);
    expect(events[0].user_id).toBe(user.id);
    expect(events[0].reason).toEqual(expect.any(String));
  });

  test('[REQ-LOG-001][T-58][REQ-F-003] запит без токена до захищеної операції записується як ACCESS_DENIED REJECTED без ID', async () => {
    const ctx = createTestContext();

    await request(ctx.app).post(`${API}/bookings`).send({ sessionId: 1, seats: [{ row: 1, number: 1 }] });

    const events = findEvent(ctx.readLog(), 'ACCESS_DENIED', 'REJECTED');
    expect(events).toHaveLength(1);
    expect(events[0].user_id).toBeNull();
  });

  test('[REQ-LOG-001][T-58][N-33] системний збій дає 500 INTERNAL_ERROR і запис SYSTEM_ERROR ERROR', async () => {
    const ctx = createTestContext();
    ctx.db.close(); // імітація збою сховища

    const res = await request(ctx.app).get(`${API}/sessions`);

    expect(res.status).toBe(500);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('INTERNAL_ERROR');
    const events = findEvent(ctx.readLog(), 'SYSTEM_ERROR', 'ERROR');
    expect(events).toHaveLength(1);
    expect(events[0].reason).toEqual(expect.any(String));
  });
});

describe('REQ-LOG-002, кожен запис API має обов\'язкові поля', () => {
  test('[REQ-LOG-002][T-60] усі записи після типового сценарію мають шість полів правильних типів', async () => {
    const ctx = createTestContext();
    const user = await registerAndLogin(ctx.app);
    await login(ctx.app, { email: user.email, password: 'wrongpass' });
    await request(ctx.app).get(`${API}/admin/films`).set('Authorization', `Bearer ${user.token}`);
    await request(ctx.app).get(`${API}/bookings`);

    const entries = ctx.readLog();

    expect(entries.length).toBeGreaterThanOrEqual(5);
    for (const e of entries) {
      expect(Object.keys(e)).toEqual(expect.arrayContaining(['timestamp', 'event_type', 'status', 'user_id', 'entity_ids', 'reason']));
      expect(e.timestamp).toMatch(ISO_UTC);
      expect(typeof e.event_type).toBe('string');
      expect(['SUCCESS', 'REJECTED', 'ERROR']).toContain(e.status);
      expect(e.user_id === null || Number.isInteger(e.user_id)).toBe(true);
      expect(e.entity_ids !== null && typeof e.entity_ids === 'object' && !Array.isArray(e.entity_ids)).toBe(true);
      expect(e.reason === null || typeof e.reason === 'string').toBe(true);
    }
  });
});

describe('REQ-LOG-003, у лозі немає паролів і токенів', () => {
  test('[REQ-LOG-003][T-62][T-70] після реєстрації, входу і запитів з токеном файл логу не містить паролів і токенів', async () => {
    const ctx = createTestContext();
    const password = 'VerySecret987';
    const user = await registerAndLogin(ctx.app, { password });
    const adminToken = await loginAs(ctx.app, TEST_ADMIN);
    await register(ctx.app, { email: user.email, password: 'OtherSecret654' }); // відхилена реєстрація
    await login(ctx.app, { email: user.email, password: 'WrongSecret321' }); // відхилений вхід
    await request(ctx.app).get(`${API}/admin/films`).set('Authorization', `Bearer ${user.token}`);
    await request(ctx.app).get(`${API}/bookings`).set('Authorization', 'Bearer forged-token-xyz');

    const raw = ctx.readLogRaw();

    expect(raw.length).toBeGreaterThan(0);
    const secrets = [password, 'OtherSecret654', 'WrongSecret321', TEST_ADMIN.password, user.token, adminToken, 'forged-token-xyz'];
    for (const secret of secrets) {
      expect(raw).not.toContain(secret);
      for (const enc of b64Variants(secret)) expect(raw).not.toContain(enc);
    }
  });
});

describe('REQ-LOG-004, лог зберігається після перезапуску', () => {
  test('[REQ-LOG-004][T-64] після перезапуску застосунку записи попереднього запуску доступні, нові дописуються', async () => {
    const first = createTestContext();
    await register(first.app, { email: uniqueEmail('before'), password: 'secret123' });
    const before = first.readLog();

    const restarted = createTestContext({ logFilePath: first.logFilePath });
    await register(restarted.app, { email: uniqueEmail('after'), password: 'secret123' });
    const after = restarted.readLog();

    expect(before.length).toBeGreaterThan(0);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.length).toBeGreaterThan(before.length);
  });
});
