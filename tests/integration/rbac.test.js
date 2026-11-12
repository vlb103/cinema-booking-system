// Раунд 1. Автентифікація запитів і ролі (RBAC).
// Джерела: SRS REQ-F-003, REQ-F-006, REQ-NF-003, REQ-NF-005, матриця RBAC §2.2, ADD-01, ADD-10,
// openapi (глобальний bearerAuth, відповіді Unauthorized і Forbidden),
// сценарії N-01, N-02, N-03, N-12, N-23, N-24, тікети T-10, T-16, T-18.
// Тут перевіряється лише доступ. Бізнес-логіку бронювань і адмін-операцій перевіряють наступні раунди.
const request = require('supertest');
const { API, TEST_ADMIN, createTestContext } = require('../helpers/testContext');
const { register, registerAndLogin, loginAs, uniqueEmail } = require('../helpers/api');

// Усі захищені операції openapi.yaml з коректним тілом, щоб відмова була саме через доступ.
const BOOKING_OPS = [
  ['createBooking', 'post', '/bookings', { sessionId: 1, seats: [{ row: 1, number: 1 }] }],
  ['listMyBookings', 'get', '/bookings', undefined],
  ['cancelBooking', 'post', '/bookings/1/cancel', undefined],
];
const ADMIN_OPS = [
  ['adminListFilms', 'get', '/admin/films', undefined],
  ['adminCreateFilm', 'post', '/admin/films', { title: 'The Matrix', durationMinutes: 136 }],
  ['adminUpdateFilm', 'patch', '/admin/films/1', { description: 'Нова' }],
  ['adminListHalls', 'get', '/admin/halls', undefined],
  ['adminCreateHall', 'post', '/admin/halls', { name: 'Зал 3', rowsCount: 8, seatsPerRow: 10 }],
  ['adminCreateSession', 'post', '/admin/sessions', { filmId: 1, hallId: 1, startTime: '2026-11-20T18:00:00Z' }],
  ['adminUpdateSession', 'patch', '/admin/sessions/1', { startTime: '2026-11-20T19:00:00Z' }],
  ['adminCancelSession', 'post', '/admin/sessions/1/cancel', { reason: 'Аварійне відключення живлення' }],
];
const PROTECTED_OPS = [...BOOKING_OPS, ...ADMIN_OPS];

function call(app, method, path, body, headers = {}) {
  let req = request(app)[method](`${API}${path}`);
  for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
  return body === undefined ? req : req.send(body);
}

describe('Автентифікація захищених операцій', () => {
  test.each(PROTECTED_OPS)('[REQ-F-003][REQ-NF-003][ADD-01] %s без токена повертає 401 UNAUTHORIZED', async (_op, method, path, body) => {
    const ctx = createTestContext();

    const res = await call(ctx.app, method, path, body);

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  test.each(PROTECTED_OPS)('[REQ-F-003][REQ-NF-003][ADD-01] %s з недійсним токеном повертає 401 UNAUTHORIZED', async (_op, method, path, body) => {
    const ctx = createTestContext();

    const res = await call(ctx.app, method, path, body, { Authorization: 'Bearer not-a-real-token' });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  test.each([
    ['схема Basic', (t) => `Basic ${t}`],
    ['токен без схеми', (t) => t],
    ['порожній Bearer', () => 'Bearer '],
  ])('[REQ-F-003][ADD-01] заголовок Authorization у форматі «%s» не приймається, 401', async (_name, header) => {
    const ctx = createTestContext();
    const user = await registerAndLogin(ctx.app);

    const res = await call(ctx.app, 'get', '/bookings', undefined, { Authorization: header(user.token) });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  test('[REQ-F-003][N-01] спроба бронювання без входу не створює бронювання', async () => {
    const ctx = createTestContext();

    const res = await call(ctx.app, 'post', '/bookings', { sessionId: 1, seats: [{ row: 1, number: 1 }] });

    expect(res.status).toBe(401);
    expect(ctx.db.prepare('SELECT COUNT(*) AS n FROM bookings').get().n).toBe(0);
  });
});

describe('Ролі (RBAC)', () => {
  test.each(ADMIN_OPS)('[REQ-F-006][REQ-NF-003][T-16][N-24] USER викликає %s і отримує 403 FORBIDDEN', async (_op, method, path, body) => {
    const ctx = createTestContext();
    const user = await registerAndLogin(ctx.app);

    const res = await call(ctx.app, method, path, body, { Authorization: `Bearer ${user.token}` });

    expect(res.status).toBe(403);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test('[REQ-NF-003][T-18] відмова USER в адмін-операції не змінює дані', async () => {
    const ctx = createTestContext();
    const user = await registerAndLogin(ctx.app);

    await call(ctx.app, 'post', '/admin/films', { title: 'The Matrix', durationMinutes: 136 }, { Authorization: `Bearer ${user.token}` });
    await call(ctx.app, 'post', '/admin/halls', { name: 'Зал 3', rowsCount: 8, seatsPerRow: 10 }, { Authorization: `Bearer ${user.token}` });

    expect(ctx.db.prepare('SELECT COUNT(*) AS n FROM films').get().n).toBe(0);
    expect(ctx.db.prepare('SELECT COUNT(*) AS n FROM halls').get().n).toBe(0);
  });

  test('[REQ-NF-003][T-18] роль береться з облікового запису на сервері, підміна ролі в заголовках і тілі не діє', async () => {
    const ctx = createTestContext();
    const user = await registerAndLogin(ctx.app);

    const res = await call(
      ctx.app, 'post', '/admin/films',
      { title: 'The Matrix', durationMinutes: 136, role: 'ADMIN', userRole: 'ADMIN' },
      { Authorization: `Bearer ${user.token}`, 'X-Role': 'ADMIN', 'X-User-Role': 'ADMIN' },
    );

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test('[REQ-NF-005][T-14][REQ-F-006] користувач, що реєструвався з role ADMIN, не має доступу до адмін-операцій', async () => {
    const ctx = createTestContext();
    const email = uniqueEmail('hacker');
    await register(ctx.app, { email, password: 'secret123', role: 'ADMIN' });
    const token = await loginAs(ctx.app, { email, password: 'secret123' });

    const res = await call(ctx.app, 'get', '/admin/films', undefined, { Authorization: `Bearer ${token}` });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test.each([
    ['adminListFilms', '/admin/films'],
    ['adminListHalls', '/admin/halls'],
  ])('[REQ-F-006][§2.2] ADMIN має доступ до %s, 200', async (_op, path) => {
    const ctx = createTestContext();
    const token = await loginAs(ctx.app, TEST_ADMIN);

    const res = await call(ctx.app, 'get', path, undefined, { Authorization: `Bearer ${token}` });

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('[REQ-F-006][ADD-10][N-12] ADMIN не може створити бронювання, 403 FORBIDDEN', async () => {
    const ctx = createTestContext();
    const token = await loginAs(ctx.app, TEST_ADMIN);

    const res = await call(ctx.app, 'post', '/bookings', { sessionId: 1, seats: [{ row: 1, number: 1 }] }, { Authorization: `Bearer ${token}` });

    expect(res.status).toBe(403);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('FORBIDDEN');
    expect(ctx.db.prepare('SELECT COUNT(*) AS n FROM bookings').get().n).toBe(0);
  });

  test('[REQ-F-006][ADD-10] ADMIN не має кабінету бронювань, GET /bookings 403 FORBIDDEN', async () => {
    const ctx = createTestContext();
    const token = await loginAs(ctx.app, TEST_ADMIN);

    const res = await call(ctx.app, 'get', '/bookings', undefined, { Authorization: `Bearer ${token}` });

    expect(res.status).toBe(403);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test('[REQ-F-001][§2.2] публічні операції доступні і з токеном будь-якої ролі', async () => {
    const ctx = createTestContext();
    const user = await registerAndLogin(ctx.app);
    const adminToken = await loginAs(ctx.app, TEST_ADMIN);

    const asUser = await call(ctx.app, 'get', '/sessions', undefined, { Authorization: `Bearer ${user.token}` });
    const asAdmin = await call(ctx.app, 'get', '/sessions', undefined, { Authorization: `Bearer ${adminToken}` });

    expect(asUser.status).toBe(200);
    expect(asAdmin.status).toBe(200);
  });
});
