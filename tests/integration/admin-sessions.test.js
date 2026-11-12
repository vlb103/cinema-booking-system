// Раунд 3. Адміністрування сеансів і скасування сеансу.
// Джерела: SRS REQ-F-015, REQ-F-016, REQ-F-017, REQ-F-018, REQ-F-019, REQ-F-020, REQ-TDD-003, BDD-сценарій 6,
// ADD-07, ADD-08, ADD-11, ADD-13, openapi adminCreateSession, adminUpdateSession, adminCancelSession,
// сценарії P-15..P-18, N-26..N-32, тікети T-45..T-56.
const { TEST_NOW, createTestContext } = require('../helpers/testContext');
const { registerAndLogin } = require('../helpers/api');
const { insertFilm, insertHall, insertSession, insertBooking, insertUser } = require('../helpers/fixtures');
const { HOUR, book, myBookings, seatMap, seats } = require('../helpers/bookings');
const { adminLogin, adminCall, publicSessions, cancelBooking } = require('../helpers/admin');

const at = (offsetMs) => new Date(new Date(TEST_NOW).getTime() + offsetMs).toISOString();
const REASON = 'Аварійне відключення живлення';

async function setup() {
  const ctx = createTestContext();
  const admin = await adminLogin(ctx.app);
  const filmId = insertFilm(ctx.db, { title: 'Interstellar', durationMinutes: 169 });
  const hallId = insertHall(ctx.db, { name: 'Зал 2', rowsCount: 3, seatsPerRow: 8 });
  return { ctx, admin, filmId, hallId, call: (method, path, body) => adminCall(ctx.app, admin.token, method, path, body) };
}

const sessionRow = (db, id) => db.prepare('SELECT film_id, hall_id, start_time, status, cancellation_reason FROM sessions WHERE id = ?').get(id);

describe('POST /admin/sessions (adminCreateSession)', () => {
  test('[REQ-F-015][P-15] створення сеансу повертає 201 Session зі статусом ACTIVE', async () => {
    const { filmId, hallId, call } = await setup();

    const res = await call('post', '/sessions', { filmId, hallId, startTime: at(6 * HOUR) });

    expect(res.status).toBe(201);
    expect(res).toSatisfyApiSpec();
    expect(res.body).toMatchObject({ filmId, hallId, status: 'ACTIVE', cancellationReason: null });
    expect(new Date(res.body.startTime).toISOString()).toBe(at(6 * HOUR));
  });

  test('[REQ-F-015][P-15] доданий адміністратором сеанс з\'являється в публічній афіші', async () => {
    const { ctx, filmId, hallId, call } = await setup();

    const created = await call('post', '/sessions', { filmId, hallId, startTime: at(6 * HOUR) });
    const afisha = await publicSessions(ctx.app);

    expect(afisha.status).toBe(200);
    expect(afisha.body.map((s) => s.id)).toContain(created.body.id);
    expect(afisha.body.find((s) => s.id === created.body.id)).toMatchObject({ film: { id: filmId }, hall: { id: hallId } });
  });

  test('[REQ-F-015][REQ-F-002] для нового сеансу доступна схема залу, всі місця вільні', async () => {
    const { ctx, filmId, hallId, call } = await setup();

    const created = await call('post', '/sessions', { filmId, hallId, startTime: at(6 * HOUR) });
    const map = await seatMap(ctx.app, created.body.id);

    expect(map.seats).toHaveLength(24);
    expect(map.seats.every((s) => s.status === 'FREE')).toBe(true);
  });

  test('[REQ-F-015][ADD-07] час з іншим часовим поясом зберігається як той самий момент в UTC', async () => {
    const { filmId, hallId, call } = await setup();

    const res = await call('post', '/sessions', { filmId, hallId, startTime: '2026-11-20T20:00:00+02:00' });

    expect(res.status).toBe(201);
    expect(new Date(res.body.startTime).toISOString()).toBe('2026-11-20T18:00:00.000Z');
    expect(res.body.startTime).toMatch(/Z$/);
  });

  test('[REQ-F-015][ADD-08] перетин сеансів в одному залі у версії 1 не перевіряється', async () => {
    const { filmId, hallId, call } = await setup();

    const a = await call('post', '/sessions', { filmId, hallId, startTime: at(6 * HOUR) });
    const b = await call('post', '/sessions', { filmId, hallId, startTime: at(6 * HOUR) });

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
  });

  test.each([
    ['неіснуючий фільм', (f, h) => ({ filmId: 9999, hallId: h, startTime: at(6 * HOUR) })],
    ['неіснуючий зал', (f) => ({ filmId: f, hallId: 9999, startTime: at(6 * HOUR) })],
  ])('[REQ-F-015][ADD-03] сеанс з посиланням на %s повертає 404 NOT_FOUND', async (_name, makeBody) => {
    const { ctx, filmId, hallId, call } = await setup();

    const res = await call('post', '/sessions', makeBody(filmId, hallId));

    expect(res.status).toBe(404);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('NOT_FOUND');
    expect(ctx.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n).toBe(0);
  });

  test.each([
    ['без startTime', (f, h) => ({ filmId: f, hallId: h })],
    ['без filmId', (f, h) => ({ hallId: h, startTime: at(6 * HOUR) })],
    ['без hallId', (f) => ({ filmId: f, startTime: at(6 * HOUR) })],
    ['startTime не дата', (f, h) => ({ filmId: f, hallId: h, startTime: 'завтра ввечері' })],
    ['filmId рядком', (f, h) => ({ filmId: String(f), hallId: h, startTime: at(6 * HOUR) })],
  ])('[REQ-F-015][ADD-03] сеанс %s відхиляється 400 VALIDATION_ERROR', async (_name, makeBody) => {
    const { ctx, filmId, hallId, call } = await setup();

    const res = await call('post', '/sessions', makeBody(filmId, hallId));

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(ctx.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n).toBe(0);
  });
});

describe('PATCH /admin/sessions/{sessionId} (adminUpdateSession)', () => {
  test('[REQ-F-016][P-16] зміна часу сеансу без бронювань успішна, афіша показує новий час', async () => {
    const { ctx, filmId, hallId, call } = await setup();
    const id = insertSession(ctx.db, { filmId, hallId, startTime: at(6 * HOUR) });

    const res = await call('patch', `/sessions/${id}`, { startTime: at(7 * HOUR) });
    const afisha = await publicSessions(ctx.app);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(new Date(res.body.startTime).toISOString()).toBe(at(7 * HOUR));
    expect(new Date(afisha.body.find((s) => s.id === id).startTime).toISOString()).toBe(at(7 * HOUR));
  });

  test('[REQ-F-016][ADD-13] зміна залу і фільму без бронювань успішна, незмінені поля лишаються', async () => {
    const { ctx, filmId, hallId, call } = await setup();
    const id = insertSession(ctx.db, { filmId, hallId, startTime: at(6 * HOUR) });
    const film2 = insertFilm(ctx.db, { title: 'The Matrix' });
    const hall2 = insertHall(ctx.db, { name: 'Зал 1' });

    const res = await call('patch', `/sessions/${id}`, { filmId: film2, hallId: hall2 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, filmId: film2, hallId: hall2, status: 'ACTIVE' });
    expect(new Date(res.body.startTime).toISOString()).toBe(at(6 * HOUR));
  });

  test('[REQ-F-016][REQ-F-017] сеанс лише зі скасованими бронюваннями можна редагувати', async () => {
    const { ctx, filmId, hallId, call } = await setup();
    const id = insertSession(ctx.db, { filmId, hallId, startTime: at(6 * HOUR) });
    insertBooking(ctx.db, { userId: insertUser(ctx.db), sessionId: id, seats: seats([1, 1]), status: 'CANCELLED' });

    const res = await call('patch', `/sessions/${id}`, { startTime: at(8 * HOUR) });

    expect(res.status).toBe(200);
  });

  test.each([
    ['зал', (ctx) => ({ hallId: insertHall(ctx.db, { name: 'Зал 1' }) })],
    ['час', () => ({ startTime: at(9 * HOUR) })],
    ['фільм', (ctx) => ({ filmId: insertFilm(ctx.db, { title: 'The Matrix' }) })],
  ])('[REQ-F-017][REQ-TDD-003][N-26] BDD-сценарій 6, зміна поля «%s» сеансу з активними бронюваннями блокується 409', async (_name, makeBody) => {
    const { ctx, filmId, hallId, call } = await setup();
    const id = insertSession(ctx.db, { filmId, hallId, startTime: at(6 * HOUR) });
    insertBooking(ctx.db, { userId: insertUser(ctx.db), sessionId: id, seats: seats([1, 1]) });
    const before = sessionRow(ctx.db, id);

    const res = await call('patch', `/sessions/${id}`, makeBody(ctx));

    expect(res.status).toBe(409);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('SESSION_HAS_ACTIVE_BOOKINGS');
    expect(sessionRow(ctx.db, id)).toEqual(before);
  });

  test('[REQ-F-016][ADD-13][N-27] порожнє тіло відхиляється 400 VALIDATION_ERROR', async () => {
    const { ctx, filmId, hallId, call } = await setup();
    const id = insertSession(ctx.db, { filmId, hallId, startTime: at(6 * HOUR) });

    const res = await call('patch', `/sessions/${id}`, {});

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('[REQ-F-016][ADD-03] некоректний startTime відхиляється 400 VALIDATION_ERROR', async () => {
    const { ctx, filmId, hallId, call } = await setup();
    const id = insertSession(ctx.db, { filmId, hallId, startTime: at(6 * HOUR) });

    const res = await call('patch', `/sessions/${id}`, { startTime: 'не дата' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('[REQ-F-017][ADD-11][N-28] скасований сеанс редагувати не можна, 409 SESSION_ALREADY_CANCELLED', async () => {
    const { ctx, filmId, hallId, call } = await setup();
    const id = insertSession(ctx.db, { filmId, hallId, startTime: at(6 * HOUR), status: 'CANCELLED', cancellationReason: REASON });

    const res = await call('patch', `/sessions/${id}`, { startTime: at(7 * HOUR) });

    expect(res.status).toBe(409);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('SESSION_ALREADY_CANCELLED');
  });

  test.each([
    ['неіснуючий сеанс', () => '/sessions/9999', () => ({ startTime: at(7 * HOUR) })],
    ['неіснуючий зал', (id) => `/sessions/${id}`, () => ({ hallId: 9999 })],
    ['неіснуючий фільм', (id) => `/sessions/${id}`, () => ({ filmId: 9999 })],
  ])('[REQ-F-016][ADD-03] %s повертає 404 NOT_FOUND', async (_name, makePath, makeBody) => {
    const { ctx, filmId, hallId, call } = await setup();
    const id = insertSession(ctx.db, { filmId, hallId, startTime: at(6 * HOUR) });

    const res = await call('patch', makePath(id), makeBody());

    expect(res.status).toBe(404);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('POST /admin/sessions/{sessionId}/cancel (adminCancelSession)', () => {
  async function sessionWithBookings() {
    const s = await setup();
    const id = insertSession(s.ctx.db, { filmId: s.filmId, hallId: s.hallId, startTime: at(6 * HOUR) });
    const alice = await registerAndLogin(s.ctx.app);
    const bob = await registerAndLogin(s.ctx.app);
    const a = await book(s.ctx.app, alice.token, { sessionId: id, seats: seats([1, 1], [1, 2]) });
    const b = await book(s.ctx.app, bob.token, { sessionId: id, seats: seats([2, 5]) });
    return { ...s, sessionId: id, alice, bob, bookingA: a.body, bookingB: b.body };
  }

  test('[REQ-F-018][REQ-F-019][P-17] BDD-сценарій 6, скасування сеансу з причиною повертає 200 і кількість скасованих бронювань', async () => {
    const { ctx, sessionId, call } = await sessionWithBookings();

    const res = await call('post', `/sessions/${sessionId}/cancel`, { reason: REASON });

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body.session).toMatchObject({ id: sessionId, status: 'CANCELLED', cancellationReason: REASON });
    expect(res.body.cancelledBookingsCount).toBe(2);
    expect(sessionRow(ctx.db, sessionId)).toMatchObject({ status: 'CANCELLED', cancellation_reason: REASON });
  });

  test('[REQ-F-019] усі активні бронювання сеансу каскадно отримують статус CANCELLED і зберігаються в історії', async () => {
    const { ctx, sessionId, bookingA, bookingB, call } = await sessionWithBookings();

    await call('post', `/sessions/${sessionId}/cancel`, { reason: REASON });

    const rows = ctx.db.prepare('SELECT id, status, cancellation_reason, cancelled_at FROM bookings WHERE session_id = ? ORDER BY id').all(sessionId);
    expect(rows.map((r) => r.id)).toEqual([bookingA.id, bookingB.id].sort((x, y) => x - y));
    for (const r of rows) {
      expect(r.status).toBe('CANCELLED');
      expect(r.cancellation_reason).toBe(REASON);
      expect(r.cancelled_at).not.toBeNull();
    }
  });

  test('[REQ-F-020][REQ-F-019][P-18] BDD-сценарій 6, клієнт бачить у кабінеті скасування і причину', async () => {
    const { ctx, sessionId, alice, bookingA, call } = await sessionWithBookings();

    await call('post', `/sessions/${sessionId}/cancel`, { reason: REASON });
    const res = await myBookings(ctx.app, alice.token);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body.find((b) => b.id === bookingA.id)).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: REASON,
      session: { id: sessionId, status: 'CANCELLED' },
    });
  });

  test('[REQ-F-019][REQ-F-014] бронювання, скасоване клієнтом раніше, не рахується і зберігає свій стан', async () => {
    const { ctx, sessionId, alice, bookingA, call } = await sessionWithBookings();
    const own = await cancelBooking(ctx.app, alice.token, bookingA.id);

    const res = await call('post', `/sessions/${sessionId}/cancel`, { reason: REASON });

    expect(res.body.cancelledBookingsCount).toBe(1);
    const row = ctx.db.prepare('SELECT cancelled_at, cancellation_reason FROM bookings WHERE id = ?').get(bookingA.id);
    expect(row.cancellation_reason).toBeNull();
    expect(new Date(row.cancelled_at).toISOString()).toBe(new Date(own.body.cancelledAt).toISOString());
  });

  test('[REQ-F-018][REQ-F-001] скасований сеанс зникає з афіші, бронювати його не можна', async () => {
    const { ctx, sessionId, call } = await sessionWithBookings();
    const late = await registerAndLogin(ctx.app);

    await call('post', `/sessions/${sessionId}/cancel`, { reason: REASON });
    const afisha = await publicSessions(ctx.app);
    const attempt = await book(ctx.app, late.token, { sessionId, seats: seats([3, 3]) });

    expect(afisha.body.map((s) => s.id)).not.toContain(sessionId);
    expect(attempt.status).toBe(409);
    expect(attempt.body.code).toBe('SESSION_NOT_AVAILABLE');
  });

  test('[REQ-F-018][ADD-11] сеанс без бронювань теж можна скасувати, кількість 0', async () => {
    const { ctx, filmId, hallId, call } = await setup();
    const id = insertSession(ctx.db, { filmId, hallId, startTime: at(6 * HOUR) });

    const res = await call('post', `/sessions/${id}/cancel`, { reason: 'Технічна перерва' });

    expect(res.status).toBe(200);
    expect(res.body.cancelledBookingsCount).toBe(0);
  });

  test('[REQ-F-017][REQ-F-018] BDD-сценарій 6 повністю, зміну заблоковано, потім сеанс скасовано з причиною', async () => {
    const { ctx, sessionId, bob, call } = await sessionWithBookings();
    const hall2 = insertHall(ctx.db, { name: 'Зал 1' });

    const patch = await call('patch', `/sessions/${sessionId}`, { hallId: hall2 });
    const cancel = await call('post', `/sessions/${sessionId}/cancel`, { reason: REASON });
    const cabinet = await myBookings(ctx.app, bob.token);

    expect(patch.status).toBe(409);
    expect(cancel.status).toBe(200);
    expect(cabinet.body.every((b) => b.status === 'CANCELLED' && b.cancellationReason === REASON)).toBe(true);
  });

  test.each([
    ['[N-29] без поля причини', {}],
    ['[N-30] з порожньою причиною', { reason: '' }],
    ['[N-31] з причиною лише з пробілів', { reason: '   ' }],
    ['з причиною довшою за 500 символів', { reason: 'r'.repeat(501) }],
  ])('[REQ-F-018][REQ-TDD-003][ADD-11] скасування сеансу %s відхиляється 400, сеанс і бронювання не змінюються', async (_name, body) => {
    const { ctx, sessionId, bookingA, call } = await sessionWithBookings();

    const res = await call('post', `/sessions/${sessionId}/cancel`, body);

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(sessionRow(ctx.db, sessionId).status).toBe('ACTIVE');
    expect(ctx.db.prepare('SELECT status FROM bookings WHERE id = ?').get(bookingA.id).status).toBe('ACTIVE');
  });

  test('[REQ-F-018][ADD-11] граничний випадок, причина рівно 500 символів приймається', async () => {
    const { ctx, filmId, hallId, call } = await setup();
    const id = insertSession(ctx.db, { filmId, hallId, startTime: at(6 * HOUR) });

    const res = await call('post', `/sessions/${id}/cancel`, { reason: 'r'.repeat(500) });

    expect(res.status).toBe(200);
  });

  test('[REQ-F-018][ADD-11][N-32] повторне скасування сеансу повертає 409 SESSION_ALREADY_CANCELLED, причина не змінюється', async () => {
    const { ctx, sessionId, call } = await sessionWithBookings();
    await call('post', `/sessions/${sessionId}/cancel`, { reason: REASON });

    const res = await call('post', `/sessions/${sessionId}/cancel`, { reason: 'Повтор' });

    expect(res.status).toBe(409);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('SESSION_ALREADY_CANCELLED');
    expect(sessionRow(ctx.db, sessionId).cancellation_reason).toBe(REASON);
  });

  test('[REQ-F-018][ADD-03] скасування неіснуючого сеансу повертає 404 NOT_FOUND', async () => {
    const { call } = await setup();

    const res = await call('post', '/sessions/9999/cancel', { reason: REASON });

    expect(res.status).toBe(404);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
