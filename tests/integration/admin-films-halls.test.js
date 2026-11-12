// Раунд 3. Адміністрування фільмів і залів.
// Джерела: SRS REQ-F-015, REQ-F-006, §3.2 п.1–2, ADD-07, ADD-13, openapi adminListFilms, adminCreateFilm,
// adminUpdateFilm, adminListHalls, adminCreateHall, схеми FilmCreate, FilmUpdate, HallCreate,
// сценарії P-10..P-14, N-25, тікети T-45, T-46.
// Відмови USER (403) і аноніма (401) перевіряються в rbac.test.js раунду 1.
const { TEST_NOW, createTestContext } = require('../helpers/testContext');
const { insertFilm, insertHall, insertSession } = require('../helpers/fixtures');
const { HOUR } = require('../helpers/bookings');
const { adminLogin, adminCall, publicSessions } = require('../helpers/admin');

async function setup() {
  const ctx = createTestContext();
  const admin = await adminLogin(ctx.app);
  return { ctx, admin, call: (method, path, body) => adminCall(ctx.app, admin.token, method, path, body) };
}

const filmsCount = (db) => db.prepare('SELECT COUNT(*) AS n FROM films').get().n;
const hallsCount = (db) => db.prepare('SELECT COUNT(*) AS n FROM halls').get().n;

describe('Фільми', () => {
  test('[REQ-F-015][P-10] GET /admin/films повертає всі фільми за схемою Film', async () => {
    const { ctx, call } = await setup();
    const id1 = insertFilm(ctx.db, { title: 'Interstellar', durationMinutes: 169, description: 'Про космос' });
    const id2 = insertFilm(ctx.db, { title: 'The Matrix', durationMinutes: 136, description: 'Бойовик' });

    const res = await call('get', '/films');

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body).toEqual(expect.arrayContaining([
      { id: id1, title: 'Interstellar', durationMinutes: 169, description: 'Про космос' },
      { id: id2, title: 'The Matrix', durationMinutes: 136, description: 'Бойовик' },
    ]));
    expect(res.body).toHaveLength(2);
  });

  test('[REQ-F-015][P-11] POST /admin/films додає фільм, 201 Film з новим ID', async () => {
    const { ctx, call } = await setup();

    const res = await call('post', '/films', { title: 'The Matrix', durationMinutes: 136, description: 'Науково-фантастичний бойовик' });

    expect(res.status).toBe(201);
    expect(res).toSatisfyApiSpec();
    expect(res.body).toMatchObject({ title: 'The Matrix', durationMinutes: 136, description: 'Науково-фантастичний бойовик' });
    expect(Number.isInteger(res.body.id)).toBe(true);
    expect(filmsCount(ctx.db)).toBe(1);
  });

  test('[REQ-F-015][P-11] доданий фільм з\'являється в переліку фільмів', async () => {
    const { call } = await setup();
    const created = await call('post', '/films', { title: 'Dune', durationMinutes: 155 });

    const list = await call('get', '/films');

    expect(list.body.map((f) => f.id)).toContain(created.body.id);
  });

  test('[REQ-F-015][ADD-07] опис фільму необов\'язковий', async () => {
    const { call } = await setup();

    const res = await call('post', '/films', { title: 'Dune', durationMinutes: 155 });

    expect(res.status).toBe(201);
    expect(res).toSatisfyApiSpec();
  });

  test.each([
    ['назва 1 символ', { title: 'X', durationMinutes: 90 }],
    ['назва 200 символів', { title: 't'.repeat(200), durationMinutes: 90 }],
    ['тривалість 1 хвилина', { title: 'Short', durationMinutes: 1 }],
    ['опис 2000 символів', { title: 'Long', durationMinutes: 90, description: 'd'.repeat(2000) }],
  ])('[REQ-F-015][ADD-07] граничний випадок, %s приймається', async (_name, body) => {
    const { call } = await setup();

    const res = await call('post', '/films', body);

    expect(res.status).toBe(201);
  });

  test.each([
    ['[N-25] без назви', { durationMinutes: 136 }],
    ['порожня назва', { title: '', durationMinutes: 136 }],
    ['назва 201 символ', { title: 't'.repeat(201), durationMinutes: 136 }],
    ['без тривалості', { title: 'The Matrix' }],
    ['тривалість 0', { title: 'The Matrix', durationMinutes: 0 }],
    ['тривалість дробова', { title: 'The Matrix', durationMinutes: 90.5 }],
    ['тривалість рядком', { title: 'The Matrix', durationMinutes: '136' }],
    ['опис 2001 символ', { title: 'The Matrix', durationMinutes: 136, description: 'd'.repeat(2001) }],
  ])('[REQ-F-015][ADD-07][ADD-03] фільм %s відхиляється 400 VALIDATION_ERROR', async (_name, body) => {
    const { ctx, call } = await setup();

    const res = await call('post', '/films', body);

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(filmsCount(ctx.db)).toBe(0);
  });

  test('[REQ-F-015][ADD-13][P-12] PATCH змінює лише опис, решта полів без змін', async () => {
    const { ctx, call } = await setup();
    const id = insertFilm(ctx.db, { title: 'Interstellar', durationMinutes: 169, description: 'Старий опис' });

    const res = await call('patch', `/films/${id}`, { description: 'Реставрована версія' });

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body).toEqual({ id, title: 'Interstellar', durationMinutes: 169, description: 'Реставрована версія' });
  });

  test('[REQ-F-015][ADD-13] PATCH змінює назву і тривалість, зміни зберігаються', async () => {
    const { ctx, call } = await setup();
    const id = insertFilm(ctx.db, { title: 'Old', durationMinutes: 100, description: 'Опис' });

    await call('patch', `/films/${id}`, { title: 'New', durationMinutes: 120 });
    const list = await call('get', '/films');

    expect(list.body.find((f) => f.id === id)).toEqual({ id, title: 'New', durationMinutes: 120, description: 'Опис' });
  });

  test('[REQ-F-015] зміна назви фільму відображається в публічній афіші', async () => {
    const { ctx, call } = await setup();
    const filmId = insertFilm(ctx.db, { title: 'Old title' });
    const hallId = insertHall(ctx.db);
    insertSession(ctx.db, { filmId, hallId, startTime: new Date(new Date(TEST_NOW).getTime() + 2 * HOUR) });

    await call('patch', `/films/${filmId}`, { title: 'New title' });
    const afisha = await publicSessions(ctx.app);

    expect(afisha.body[0].film.title).toBe('New title');
  });

  test.each([
    ['порожнє тіло', {}],
    ['порожня назва', { title: '' }],
    ['тривалість 0', { durationMinutes: 0 }],
  ])('[REQ-F-015][ADD-13] PATCH з тілом «%s» відхиляється 400 VALIDATION_ERROR, фільм не змінюється', async (_name, body) => {
    const { ctx, call } = await setup();
    const id = insertFilm(ctx.db, { title: 'Interstellar', durationMinutes: 169 });

    const res = await call('patch', `/films/${id}`, body);

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(ctx.db.prepare('SELECT title, duration_minutes FROM films WHERE id = ?').get(id)).toEqual({ title: 'Interstellar', duration_minutes: 169 });
  });

  test('[REQ-F-015][ADD-03] PATCH неіснуючого фільму повертає 404 NOT_FOUND', async () => {
    const { call } = await setup();

    const res = await call('patch', '/films/9999', { description: 'x' });

    expect(res.status).toBe(404);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('Зали', () => {
  test('[REQ-F-015][ADD-07][P-13] POST /admin/halls створює зал, місткість рахує сервер', async () => {
    const { ctx, call } = await setup();

    const res = await call('post', '/halls', { name: 'Зал 3', rowsCount: 8, seatsPerRow: 10 });

    expect(res.status).toBe(201);
    expect(res).toSatisfyApiSpec();
    expect(res.body).toMatchObject({ name: 'Зал 3', rowsCount: 8, seatsPerRow: 10, capacity: 80 });
    expect(hallsCount(ctx.db)).toBe(1);
  });

  test('[REQ-F-015][ADD-07] передана в запиті місткість ігнорується', async () => {
    const { call } = await setup();

    const res = await call('post', '/halls', { name: 'Зал 3', rowsCount: 2, seatsPerRow: 3, capacity: 999 });

    expect(res.status).toBe(201);
    expect(res.body.capacity).toBe(6);
  });

  test('[REQ-F-015][ADD-07] граничний випадок, зал 1 ряд на 1 місце', async () => {
    const { call } = await setup();

    const res = await call('post', '/halls', { name: 'VIP', rowsCount: 1, seatsPerRow: 1 });

    expect(res.status).toBe(201);
    expect(res.body.capacity).toBe(1);
  });

  test('[REQ-F-015][P-14] GET /admin/halls повертає створені зали', async () => {
    const { call } = await setup();
    const a = await call('post', '/halls', { name: 'Зал 1', rowsCount: 10, seatsPerRow: 12 });
    const b = await call('post', '/halls', { name: 'Зал 2', rowsCount: 2, seatsPerRow: 3 });

    const res = await call('get', '/halls');

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body).toEqual(expect.arrayContaining([a.body, b.body]));
    expect(res.body).toHaveLength(2);
  });

  test.each([
    ['без назви', { rowsCount: 8, seatsPerRow: 10 }],
    ['порожня назва', { name: '', rowsCount: 8, seatsPerRow: 10 }],
    ['назва 101 символ', { name: 'n'.repeat(101), rowsCount: 8, seatsPerRow: 10 }],
    ['без кількості рядів', { name: 'Зал', seatsPerRow: 10 }],
    ['0 рядів', { name: 'Зал', rowsCount: 0, seatsPerRow: 10 }],
    ['0 місць у ряду', { name: 'Зал', rowsCount: 8, seatsPerRow: 0 }],
    ['дробова кількість рядів', { name: 'Зал', rowsCount: 2.5, seatsPerRow: 10 }],
    ['від\'ємна кількість місць', { name: 'Зал', rowsCount: 8, seatsPerRow: -1 }],
  ])('[REQ-F-015][ADD-07][ADD-03] зал %s відхиляється 400 VALIDATION_ERROR', async (_name, body) => {
    const { ctx, call } = await setup();

    const res = await call('post', '/halls', body);

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(hallsCount(ctx.db)).toBe(0);
  });
});
