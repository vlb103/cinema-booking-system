// Адендум фільтрів афіші, тікет T-82. Фільтри date і filmId у GET /sessions.
// Джерела: spec/addendum-session-filters.md (REQ-F-021, REQ-F-022, REQ-F-023, ADD-14..ADD-19,
// BDD-сценарії 7..12, випадки P-19..P-30, B-01..B-07, N-34..N-43, L-01..L-05),
// docs/api/openapi.yaml 1.1.0 (listSessions, параметри SessionDateFilter і FilmIdFilter, відповідь 400).
// Поточний час у тестах 2026-11-12T12:00:00Z (TEST_NOW).
const request = require('supertest');
const { API, createTestContext, TEST_ADMIN } = require('../helpers/testContext');
const { registerAndLogin, loginAs } = require('../helpers/api');
const { insertFilm, insertHall, insertSession } = require('../helpers/fixtures');

const LOG_FIELDS = ['timestamp', 'event_type', 'status', 'user_id', 'entity_ids', 'reason'];

function afisha(app, query = '', token) {
  const req = request(app).get(`${API}/sessions${query}`);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
}

const ids = (res) => res.body.map((s) => s.id);
const sorted = (arr) => [...arr].sort((a, b) => a - b);
const listedEvents = (ctx) => ctx.readLog().filter((e) => e.event_type === 'SESSIONS_LISTED');

// Два фільми, один зал. Повертає функцію додавання сеансу за часом UTC.
function setup() {
  const ctx = createTestContext();
  const interstellar = insertFilm(ctx.db, { title: 'Interstellar', durationMinutes: 169 });
  const matrix = insertFilm(ctx.db, { title: 'The Matrix', durationMinutes: 136 });
  const hallId = insertHall(ctx.db, { name: 'Зал 2', rowsCount: 3, seatsPerRow: 8 });
  const add = (startTime, filmId = interstellar, extra = {}) => insertSession(ctx.db, { filmId, hallId, startTime, ...extra });
  return { ctx, interstellar, matrix, hallId, add };
}

function expectValidationError(res, param) {
  expect(res.status).toBe(400);
  expect(res).toSatisfyApiSpec();
  expect(res.body.code).toBe('VALIDATION_ERROR');
  expect(res.body.details.join(' ')).toContain(param);
}

describe('BDD-сценарії адендуму', () => {
  test('[REQ-F-021][ADD-15][ADD-16][P-19] BDD-сценарій 7, афіша за датою повертає лише сеанси цієї доби без скасованих', async () => {
    const { ctx, add } = setup();
    add('2026-11-12T18:00:00Z');
    const morning = add('2026-11-13T10:00:00Z');
    const evening = add('2026-11-13T21:30:00Z');
    add('2026-11-13T15:00:00Z', undefined, { status: 'CANCELLED', cancellationReason: 'Аварія' });

    const res = await afisha(ctx.app, '?date=2026-11-13');

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(sorted(ids(res))).toEqual(sorted([morning, evening]));
  });

  test('[REQ-F-022][P-20] BDD-сценарій 8, афіша за фільмом повертає лише сеанси цього фільму', async () => {
    const { ctx, add, interstellar, matrix } = setup();
    const i1 = add('2026-11-13T10:00:00Z', interstellar);
    const i2 = add('2026-11-14T18:00:00Z', interstellar);
    add('2026-11-13T20:00:00Z', matrix);

    const res = await afisha(ctx.app, `?filmId=${interstellar}`);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(sorted(ids(res))).toEqual(sorted([i1, i2]));
    expect(res.body.every((s) => s.film.id === interstellar)).toBe(true);
  });

  test('[REQ-F-023][P-21] BDD-сценарій 9, дата і фільм разом дають перетин умов', async () => {
    const { ctx, add, interstellar, matrix } = setup();
    const target = add('2026-11-13T10:00:00Z', interstellar);
    add('2026-11-14T10:00:00Z', interstellar);
    add('2026-11-13T12:00:00Z', matrix);

    const res = await afisha(ctx.app, `?date=2026-11-13&filmId=${interstellar}`);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(ids(res)).toEqual([target]);
  });

  test('[REQ-F-023][REQ-F-001][P-22] BDD-сценарій 10, без фільтрів афіша така сама, як у версії 1.0.0', async () => {
    const { ctx, add, interstellar, matrix } = setup();
    const a = add('2026-11-13T10:00:00Z', interstellar);
    const b = add('2026-11-15T19:00:00Z', matrix);
    add('2026-11-14T10:00:00Z', interstellar, { status: 'CANCELLED', cancellationReason: 'Аварія' });
    add('2026-11-12T11:00:00Z', matrix); // уже почався

    const res = await afisha(ctx.app);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(sorted(ids(res))).toEqual(sorted([a, b]));
  });

  test('[REQ-F-021][ADD-15][B-01][B-02] BDD-сценарій 11, сеанс о 23:59:59 належить своїй добі, а опівночі вже наступній', async () => {
    const { ctx, add } = setup();
    const lastSecond = add('2026-11-13T23:59:59Z');
    const midnight = add('2026-11-14T00:00:00Z');

    const day13 = await afisha(ctx.app, '?date=2026-11-13');
    const day14 = await afisha(ctx.app, '?date=2026-11-14');

    expect(day13.status).toBe(200);
    expect(ids(day13)).toEqual([lastSecond]);
    expect(ids(day14)).toEqual([midnight]);
  });

  test('[REQ-F-021][REQ-F-022][ADD-17][ADD-18][N-34][N-43] BDD-сценарій 12, некоректний фільтр відхиляється повністю і пишеться в лог', async () => {
    const { ctx, add } = setup();
    add('2026-11-13T10:00:00Z');

    const badDate = await afisha(ctx.app, '?date=13.11.2026');
    const badFilm = await afisha(ctx.app, '?date=2026-11-13&filmId=abc');

    expectValidationError(badDate, 'date');
    expectValidationError(badFilm, 'filmId');
    expect(badFilm.body).not.toBeInstanceOf(Array);
    const rejected = listedEvents(ctx).filter((e) => e.status === 'REJECTED');
    expect(rejected).toHaveLength(2);
  });
});

describe('Позитивні випадки', () => {
  test.each([
    ['[REQ-F-021][P-23] дата без сеансів', (f) => '?date=2026-12-31'],
    ['[REQ-F-022][P-24] фільм без актуальних сеансів', (f) => `?filmId=${f.matrix}`],
    ['[REQ-F-022][P-25] неіснуючий фільм, 200 а не 404', () => '?filmId=9999'],
    ['[REQ-F-021][ADD-16][P-26] минула дата, порожній список а не помилка', () => '?date=2026-11-01'],
  ])('%s повертає 200 і порожній масив', async (_name, makeQuery) => {
    const f = setup();
    f.add('2026-11-13T10:00:00Z', f.interstellar);
    f.add('2026-11-01T10:00:00Z', f.interstellar); // минулий сеанс

    const res = await afisha(f.ctx.app, makeQuery(f));

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body).toEqual([]);
  });

  test('[REQ-F-023][ADD-16][P-27] скасований і вже розпочатий сеанси обраного дня не з\'являються з фільтром', async () => {
    const { ctx, add } = setup();
    const upcoming = add('2026-11-12T20:00:00Z');
    add('2026-11-12T15:00:00Z', undefined, { status: 'CANCELLED', cancellationReason: 'Аварія' });
    add('2026-11-12T09:00:00Z'); // уже почався
    add('2026-11-14T10:00:00Z'); // інший день

    const res = await afisha(ctx.app, '?date=2026-11-12');

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([upcoming]);
  });

  test('[REQ-F-021][REQ-F-022][§2.2][P-28] фільтри з токеном USER і ADMIN працюють так само, як без токена', async () => {
    const { ctx, add, interstellar, matrix } = setup();
    const target = add('2026-11-13T10:00:00Z', interstellar);
    add('2026-11-13T12:00:00Z', matrix);
    const user = await registerAndLogin(ctx.app);
    const adminToken = await loginAs(ctx.app, TEST_ADMIN);
    const query = `?date=2026-11-13&filmId=${interstellar}`;

    const asUser = await afisha(ctx.app, query, user.token);
    const asAdmin = await afisha(ctx.app, query, adminToken);

    expect(asUser.status).toBe(200);
    expect(asAdmin.status).toBe(200);
    expect(ids(asUser)).toEqual([target]);
    expect(ids(asAdmin)).toEqual([target]);
  });

  test('[REQ-F-023][P-29] невідомий параметр ігнорується, відповідь як без параметрів', async () => {
    const { ctx, add } = setup();
    add('2026-11-13T10:00:00Z');
    add('2026-11-14T10:00:00Z');

    const plain = await afisha(ctx.app);
    const withUnknown = await afisha(ctx.app, '?city=Kyiv');

    expect(withUnknown.status).toBe(200);
    expect(withUnknown.body).toEqual(plain.body);
  });

  test('[REQ-F-023][ADD-19][P-30] відфільтровані сеанси впорядковані за зростанням часу початку', async () => {
    const { ctx, add, interstellar, matrix } = setup();
    const late = add('2026-11-15T20:00:00Z', interstellar);
    add('2026-11-13T09:00:00Z', matrix);
    const early = add('2026-11-13T10:00:00Z', interstellar);
    const middle = add('2026-11-14T15:00:00Z', interstellar);

    const res = await afisha(ctx.app, `?filmId=${interstellar}`);

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([early, middle, late]);
  });
});

describe('Граничні випадки', () => {
  test('[REQ-F-021][ADD-16][B-03] сьогоднішня дата, сеанс рівно зараз не показується', async () => {
    const { ctx, add } = setup();
    add('2026-11-12T12:00:00Z');
    const later = add('2026-11-12T19:00:00Z');
    add('2026-11-13T19:00:00Z'); // інший день

    const res = await afisha(ctx.app, '?date=2026-11-12');

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([later]);
  });

  test('[REQ-F-021][ADD-16][B-04] сьогоднішня дата, сеанс через 1 секунду показується', async () => {
    const { ctx, add } = setup();
    const soon = add('2026-11-12T12:00:01Z');
    add('2026-11-13T12:00:01Z');

    const res = await afisha(ctx.app, '?date=2026-11-12');

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([soon]);
  });

  test('[REQ-F-022][B-05] мінімальний filmId=1 приймається', async () => {
    const { ctx, add, interstellar, matrix } = setup();
    expect(interstellar).toBe(1);
    const target = add('2026-11-13T10:00:00Z', interstellar);
    add('2026-11-13T12:00:00Z', matrix);

    const res = await afisha(ctx.app, '?filmId=1');

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([target]);
  });

  test('[REQ-F-021][B-06] 29 лютого високосного року приймається', async () => {
    const { ctx, add } = setup();
    const leap = add('2028-02-29T18:00:00Z');
    add('2028-03-01T18:00:00Z');

    const res = await afisha(ctx.app, '?date=2028-02-29');

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([leap]);
  });

  test('[REQ-F-021][ADD-17][B-07] 29 лютого невисокосного року відхиляється 400', async () => {
    const { ctx } = setup();

    const res = await afisha(ctx.app, '?date=2026-02-29');

    expectValidationError(res, 'date');
  });
});

describe('Негативні випадки (400 VALIDATION_ERROR)', () => {
  test.each([
    ['[REQ-F-021][ADD-17][N-34] дата в іншому форматі', '?date=13.11.2026', 'date'],
    ['[REQ-F-021][N-35] неіснуючий місяць', '?date=2026-13-01', 'date'],
    ['[REQ-F-021][N-36] неіснуючий день', '?date=2026-11-31', 'date'],
    ['[REQ-F-021][N-37] дата з часом', '?date=2026-11-13T10:00:00Z', 'date'],
    ['[REQ-F-021][N-37] дата без нулів', '?date=2026-1-5', 'date'],
    ['[REQ-F-022][ADD-17][N-38] filmId не число', '?filmId=abc', 'filmId'],
    ['[REQ-F-022][N-39] filmId нуль', '?filmId=0', 'filmId'],
    ['[REQ-F-022][N-39] filmId від\'ємний', '?filmId=-1', 'filmId'],
    ['[REQ-F-022][N-40] filmId дробовий', '?filmId=1.5', 'filmId'],
    ['[REQ-F-021][ADD-17][N-41] порожня дата', '?date=', 'date'],
    ['[REQ-F-022][ADD-17][N-41] порожній filmId', '?filmId=', 'filmId'],
    ['[REQ-F-022][ADD-17][N-42] повторений filmId', '?filmId=1&filmId=2', 'filmId'],
    ['[REQ-F-021][ADD-17][N-42] повторена дата', '?date=2026-11-13&date=2026-11-14', 'date'],
    ['[REQ-F-023][N-43] коректна дата і некоректний filmId', '?date=2026-11-13&filmId=abc', 'filmId'],
    ['[REQ-F-023][N-43] некоректна дата і коректний filmId', '?date=2026-13-13&filmId=1', 'date'],
  ])('%s відхиляється, сеанси не повертаються', async (_name, query, param) => {
    const { ctx, add } = setup();
    add('2026-11-13T10:00:00Z');

    const res = await afisha(ctx.app, query);

    expectValidationError(res, param);
  });
});

describe('Логування (ADD-18)', () => {
  test('[REQ-LOG-001][ADD-18][L-01] некоректна дата записується як SESSIONS_LISTED REJECTED без користувача', async () => {
    const { ctx } = setup();

    await afisha(ctx.app, '?date=13.11.2026');

    const events = listedEvents(ctx);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ status: 'REJECTED', user_id: null, entity_ids: { date: '13.11.2026' } });
    expect(events[0].reason).toEqual(expect.any(String));
    expect(events[0].reason.length).toBeGreaterThan(0);
  });

  test('[REQ-LOG-001][ADD-18][L-02] некоректний filmId записується як SESSIONS_LISTED REJECTED зі значенням filmId', async () => {
    const { ctx } = setup();

    await afisha(ctx.app, '?filmId=abc');

    const events = listedEvents(ctx);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ status: 'REJECTED', user_id: null, entity_ids: { filmId: 'abc' } });
  });

  test('[REQ-LOG-002][ADD-18][L-03] кожен запис відмови має шість полів REQ-LOG-002', async () => {
    const { ctx } = setup();
    const queries = ['?date=13.11.2026', '?date=2026-13-01', '?filmId=0', '?filmId=', '?filmId=1&filmId=2', '?date=2026-11-13&filmId=abc'];

    for (const q of queries) await afisha(ctx.app, q);

    const events = listedEvents(ctx);
    expect(events).toHaveLength(queries.length);
    for (const e of events) {
      for (const field of LOG_FIELDS) expect(e).toHaveProperty(field);
      expect(e.status).toBe('REJECTED');
    }
  });

  test('[REQ-LOG-001][ADD-18][L-04] успішний перегляд афіші з фільтрами і без них у лог не пишеться', async () => {
    const { ctx, add, interstellar } = setup();
    add('2026-11-13T10:00:00Z', interstellar);
    const before = ctx.readLog().length;

    await afisha(ctx.app);
    await afisha(ctx.app, `?date=2026-11-13&filmId=${interstellar}`);
    await afisha(ctx.app, '?date=2026-12-31');

    expect(ctx.readLog()).toHaveLength(before);
  });

  test('[REQ-LOG-003][ADD-18][L-05] відмова з токеном у запиті не записує токен, user_id дорівнює null', async () => {
    const { ctx } = setup();
    const user = await registerAndLogin(ctx.app);

    await afisha(ctx.app, '?date=13.11.2026', user.token);

    const events = listedEvents(ctx);
    expect(events).toHaveLength(1);
    expect(events[0].user_id).toBeNull();
    expect(ctx.readLogRaw()).not.toContain(user.token);
  });
});
