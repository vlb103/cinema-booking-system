// Раунд 3. Логування скасувань бронювань і дій адміністратора.
// Джерела: SRS REQ-LOG-001 (п.2 скасування бронювання, п.3 зміни розкладу, залів, фільмів і скасування сеансів,
// п.4 відмови через бізнес-правила), REQ-LOG-002 (поля, entity_ids, reason для скасувань), REQ-LOG-003, REQ-F-014,
// тікети T-58, T-60, T-62.
const { TEST_NOW, TEST_ADMIN, createTestContext } = require('../helpers/testContext');
const { registerAndLogin } = require('../helpers/api');
const { insertFilm, insertHall, insertSession, insertBooking, insertUser } = require('../helpers/fixtures');
const { HOUR, seedBookableSession, book, seats } = require('../helpers/bookings');
const { adminLogin, adminCall, cancelBooking } = require('../helpers/admin');

const REQUIRED_FIELDS = ['timestamp', 'event_type', 'status', 'user_id', 'entity_ids', 'reason'];
const at = (offsetMs) => new Date(new Date(TEST_NOW).getTime() + offsetMs).toISOString();

function events(ctx, eventType, status) {
  return ctx.readLog().filter((e) => e.event_type === eventType && e.status === status);
}

async function bookingSetup() {
  const ctx = createTestContext();
  const session = seedBookableSession(ctx.db, TEST_NOW);
  const user = await registerAndLogin(ctx.app);
  const created = await book(ctx.app, user.token, { sessionId: session.sessionId, seats: seats([1, 1], [1, 2]) });
  return { ctx, session, user, booking: created.body };
}

async function adminSetup() {
  const ctx = createTestContext();
  const admin = await adminLogin(ctx.app);
  return { ctx, admin, call: (method, path, body) => adminCall(ctx.app, admin.token, method, path, body) };
}

describe('Логування скасування бронювань', () => {
  test('[REQ-LOG-001][REQ-LOG-002][T-58] скасування записується як BOOKING_CANCELLED SUCCESS з користувачем, бронюванням, сеансом і місцями', async () => {
    const { ctx, session, user, booking } = await bookingSetup();

    await cancelBooking(ctx.app, user.token, booking.id);

    const found = events(ctx, 'BOOKING_CANCELLED', 'SUCCESS');
    expect(found).toHaveLength(1);
    expect(found[0].user_id).toBe(user.id);
    expect(found[0].entity_ids).toMatchObject({ bookingId: booking.id, sessionId: session.sessionId });
    expect(found[0].entity_ids.seats).toEqual(expect.arrayContaining(seats([1, 1], [1, 2])));
  });

  test('[REQ-LOG-001][REQ-F-014][T-58] повторне скасування не створює другого запису про успішне скасування', async () => {
    const { ctx, user, booking } = await bookingSetup();

    await cancelBooking(ctx.app, user.token, booking.id);
    await cancelBooking(ctx.app, user.token, booking.id);

    expect(events(ctx, 'BOOKING_CANCELLED', 'SUCCESS')).toHaveLength(1);
  });

  test('[REQ-LOG-001][T-58] відмова після початку сеансу записується як BOOKING_CANCELLED REJECTED з причиною', async () => {
    const { ctx, session, user, booking } = await bookingSetup();
    ctx.clock.set(session.startTime);

    await cancelBooking(ctx.app, user.token, booking.id);

    const found = events(ctx, 'BOOKING_CANCELLED', 'REJECTED');
    expect(found).toHaveLength(1);
    expect(found[0].user_id).toBe(user.id);
    expect(found[0].entity_ids).toMatchObject({ bookingId: booking.id });
    expect(found[0].reason).toEqual(expect.any(String));
  });

  test('[REQ-LOG-001][REQ-F-005][T-58] спроба скасувати чуже бронювання записується як BOOKING_CANCELLED REJECTED з ID порушника', async () => {
    const { ctx, booking } = await bookingSetup();
    const intruder = await registerAndLogin(ctx.app);

    await cancelBooking(ctx.app, intruder.token, booking.id);

    const found = events(ctx, 'BOOKING_CANCELLED', 'REJECTED');
    expect(found).toHaveLength(1);
    expect(found[0].user_id).toBe(intruder.id);
    expect(found[0].entity_ids).toMatchObject({ bookingId: booking.id });
  });
});

describe('Логування дій адміністратора', () => {
  test('[REQ-LOG-001][T-58] додавання і зміна фільму записуються як FILM_CREATED і FILM_UPDATED з ID адміністратора', async () => {
    const { ctx, admin, call } = await adminSetup();

    const created = await call('post', '/films', { title: 'Dune', durationMinutes: 155 });
    await call('patch', `/films/${created.body.id}`, { description: 'Опис' });

    const c = events(ctx, 'FILM_CREATED', 'SUCCESS');
    const u = events(ctx, 'FILM_UPDATED', 'SUCCESS');
    expect(c).toHaveLength(1);
    expect(u).toHaveLength(1);
    expect(c[0]).toMatchObject({ user_id: admin.id, entity_ids: { filmId: created.body.id } });
    expect(u[0]).toMatchObject({ user_id: admin.id, entity_ids: { filmId: created.body.id } });
  });

  test('[REQ-LOG-001][T-58] створення залу записується як HALL_CREATED', async () => {
    const { ctx, admin, call } = await adminSetup();

    const created = await call('post', '/halls', { name: 'Зал 3', rowsCount: 8, seatsPerRow: 10 });

    const found = events(ctx, 'HALL_CREATED', 'SUCCESS');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ user_id: admin.id, entity_ids: { hallId: created.body.id } });
  });

  test('[REQ-LOG-001][T-58] створення і зміна сеансу записуються як SESSION_CREATED і SESSION_UPDATED', async () => {
    const { ctx, admin, call } = await adminSetup();
    const filmId = insertFilm(ctx.db);
    const hallId = insertHall(ctx.db);

    const created = await call('post', '/sessions', { filmId, hallId, startTime: at(6 * HOUR) });
    await call('patch', `/sessions/${created.body.id}`, { startTime: at(7 * HOUR) });

    expect(events(ctx, 'SESSION_CREATED', 'SUCCESS')[0]).toMatchObject({ user_id: admin.id, entity_ids: { sessionId: created.body.id, filmId, hallId } });
    expect(events(ctx, 'SESSION_UPDATED', 'SUCCESS')[0]).toMatchObject({ user_id: admin.id, entity_ids: { sessionId: created.body.id } });
  });

  test('[REQ-LOG-001][REQ-F-017][T-58] заблокована зміна сеансу з бронюваннями записується як SESSION_UPDATED REJECTED з причиною', async () => {
    const { ctx, admin, call } = await adminSetup();
    const filmId = insertFilm(ctx.db);
    const hallId = insertHall(ctx.db);
    const sessionId = insertSession(ctx.db, { filmId, hallId, startTime: at(6 * HOUR) });
    insertBooking(ctx.db, { userId: insertUser(ctx.db), sessionId, seats: seats([1, 1]) });

    await call('patch', `/sessions/${sessionId}`, { startTime: at(7 * HOUR) });

    const found = events(ctx, 'SESSION_UPDATED', 'REJECTED');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ user_id: admin.id, entity_ids: { sessionId } });
    expect(found[0].reason).toEqual(expect.any(String));
  });

  test('[REQ-LOG-001][REQ-LOG-002][REQ-F-018][T-58] скасування сеансу записується як SESSION_CANCELLED з причиною адміністратора і ID скасованих бронювань', async () => {
    const { ctx, admin, call } = await adminSetup();
    const filmId = insertFilm(ctx.db);
    const hallId = insertHall(ctx.db, { rowsCount: 3, seatsPerRow: 8 });
    const sessionId = insertSession(ctx.db, { filmId, hallId, startTime: at(6 * HOUR) });
    const user = await registerAndLogin(ctx.app);
    const b = await book(ctx.app, user.token, { sessionId, seats: seats([1, 1]) });

    await call('post', `/sessions/${sessionId}/cancel`, { reason: 'Аварійне відключення живлення' });

    const found = events(ctx, 'SESSION_CANCELLED', 'SUCCESS');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ user_id: admin.id, entity_ids: { sessionId }, reason: 'Аварійне відключення живлення' });
    expect(found[0].entity_ids.bookingIds).toEqual([b.body.id]);
  });

  test('[REQ-LOG-001][REQ-F-018][T-58] відмова скасувати сеанс без причини записується як SESSION_CANCELLED REJECTED', async () => {
    const { ctx, admin, call } = await adminSetup();
    const sessionId = insertSession(ctx.db, { filmId: insertFilm(ctx.db), hallId: insertHall(ctx.db), startTime: at(6 * HOUR) });

    await call('post', `/sessions/${sessionId}/cancel`, { reason: '   ' });

    const found = events(ctx, 'SESSION_CANCELLED', 'REJECTED');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ user_id: admin.id, entity_ids: { sessionId } });
  });

  test('[REQ-LOG-001][T-58] невдале створення фільму (валідація) записується як FILM_CREATED REJECTED', async () => {
    const { ctx, call } = await adminSetup();

    await call('post', '/films', { durationMinutes: 136 });

    expect(events(ctx, 'FILM_CREATED', 'REJECTED')).toHaveLength(1);
  });
});

describe('Структура і безпека записів раунду 3', () => {
  test('[REQ-LOG-002][REQ-LOG-003][T-60][T-62] усі записи мають шість полів, токенів і паролів у лозі немає', async () => {
    const { ctx, user, booking } = await bookingSetup();
    const admin = await adminLogin(ctx.app);
    const call = (method, path, body) => adminCall(ctx.app, admin.token, method, path, body);
    await cancelBooking(ctx.app, user.token, booking.id);
    const film = await call('post', '/films', { title: 'Dune', durationMinutes: 155 });
    await call('patch', `/films/${film.body.id}`, { title: 'Dune 2' });
    const hall = await call('post', '/halls', { name: 'Зал 9', rowsCount: 2, seatsPerRow: 2 });
    const session = await call('post', '/sessions', { filmId: film.body.id, hallId: hall.body.id, startTime: at(6 * HOUR) });
    await call('post', `/sessions/${session.body.id}/cancel`, { reason: 'Технічна перерва' });

    const entries = ctx.readLog();
    const types = new Set(entries.map((e) => e.event_type));
    const raw = ctx.readLogRaw();

    for (const t of ['BOOKING_CANCELLED', 'FILM_CREATED', 'FILM_UPDATED', 'HALL_CREATED', 'SESSION_CREATED', 'SESSION_CANCELLED']) {
      expect(types).toContain(t);
    }
    for (const e of entries) for (const field of REQUIRED_FIELDS) expect(e).toHaveProperty(field);
    for (const secret of [user.token, admin.token, TEST_ADMIN.password, user.password]) expect(raw).not.toContain(secret);
  });
});
