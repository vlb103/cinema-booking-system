// Раунд 3. Скасування бронювання клієнтом (cancelBooking).
// Джерела: SRS REQ-F-011, REQ-F-012, REQ-F-013, REQ-F-014, REQ-F-005, REQ-NF-004, REQ-TDD-003,
// BDD-сценарії 3, 4, 5, ADD-04, ADD-10, openapi cancelBooking,
// сценарії P-08, P-09, N-13..N-16, тікети T-37..T-44, T-80.
// Анонім (401) для cancelBooking перевіряється в rbac.test.js раунду 1.
const { TEST_NOW, createTestContext } = require('../helpers/testContext');
const { registerAndLogin } = require('../helpers/api');
const { HOUR, seedBookableSession, book, myBookings, seatMap, seatStatus, seats } = require('../helpers/bookings');
const { adminLogin, cancelBooking } = require('../helpers/admin');

// Сеанс через 2 години, користувач з активним бронюванням на задані місця.
async function setup(seatList = seats([1, 1], [1, 2])) {
  const ctx = createTestContext();
  const session = seedBookableSession(ctx.db, TEST_NOW);
  const user = await registerAndLogin(ctx.app);
  const created = await book(ctx.app, user.token, { sessionId: session.sessionId, seats: seatList });
  expect(created.status).toBe(201);
  return { ctx, user, session, booking: created.body };
}

const bookingRow = (db, id) => db.prepare('SELECT status, cancelled_at, cancellation_reason FROM bookings WHERE id = ?').get(id);

describe('POST /bookings/{bookingId}/cancel, позитивні випадки', () => {
  test('[REQ-F-011][REQ-F-012][REQ-F-013][P-08] BDD-сценарій 3, скасування власного бронювання до початку сеансу повертає 200 CANCELLED', async () => {
    const { ctx, user, booking } = await setup();
    ctx.clock.advance(HOUR + 40 * 60 * 1000); // 20 хвилин до початку

    const res = await cancelBooking(ctx.app, user.token, booking.id);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body).toMatchObject({ id: booking.id, userId: user.id, status: 'CANCELLED', cancellationReason: null });
    expect(new Date(res.body.cancelledAt).toISOString()).toBe(ctx.clock.now().toISOString());
    expect(bookingRow(ctx.db, booking.id).status).toBe('CANCELLED');
  });

  test('[REQ-F-013][P-08] після скасування всі місця одразу вільні у схемі залу', async () => {
    const { ctx, user, booking, session } = await setup(seats([2, 3], [2, 4], [2, 5]));

    await cancelBooking(ctx.app, user.token, booking.id);
    const map = await seatMap(ctx.app, session.sessionId);

    expect(seatStatus(map, 2, 3)).toBe('FREE');
    expect(seatStatus(map, 2, 4)).toBe('FREE');
    expect(seatStatus(map, 2, 5)).toBe('FREE');
  });

  test('[REQ-F-013] звільнене місце одразу може забронювати інший клієнт', async () => {
    const { ctx, user, booking, session } = await setup(seats([2, 4]));
    const other = await registerAndLogin(ctx.app);

    await cancelBooking(ctx.app, user.token, booking.id);
    const res = await book(ctx.app, other.token, { sessionId: session.sessionId, seats: seats([2, 4]) });

    expect(res.status).toBe(201);
  });

  test('[REQ-F-011] скасування лише повне, передані в тілі окремі місця ігноруються і звільняються всі місця', async () => {
    const { ctx, user, booking, session } = await setup(seats([1, 1], [1, 2], [1, 3]));

    const res = await cancelBooking(ctx.app, user.token, booking.id, { seats: seats([1, 1]) });
    const map = await seatMap(ctx.app, session.sessionId);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.seats).toHaveLength(3);
    expect([1, 2, 3].map((n) => seatStatus(map, 1, n))).toEqual(['FREE', 'FREE', 'FREE']);
  });

  test('[REQ-F-012][REQ-TDD-003] граничний випадок, скасування за 1 секунду до початку сеансу успішне', async () => {
    const { ctx, user, booking, session } = await setup();
    ctx.clock.set(new Date(new Date(session.startTime).getTime() - 1000));

    const res = await cancelBooking(ctx.app, user.token, booking.id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  test('[REQ-F-020][REQ-F-011] скасоване бронювання видно в кабінеті зі статусом CANCELLED', async () => {
    const { ctx, user, booking } = await setup();

    await cancelBooking(ctx.app, user.token, booking.id);
    const res = await myBookings(ctx.app, user.token);

    expect(res.body.find((b) => b.id === booking.id)).toMatchObject({ status: 'CANCELLED', cancellationReason: null });
  });
});

describe('POST /bookings/{bookingId}/cancel, ідемпотентність (REQ-F-014)', () => {
  test('[REQ-F-014][REQ-TDD-003][P-09] повторне скасування повертає 200 з тим самим станом без змін', async () => {
    const { ctx, user, booking } = await setup();
    const first = await cancelBooking(ctx.app, user.token, booking.id);
    ctx.clock.advance(10 * 60 * 1000);

    const second = await cancelBooking(ctx.app, user.token, booking.id);

    expect(second.status).toBe(200);
    expect(second).toSatisfyApiSpec();
    expect(second.body.status).toBe('CANCELLED');
    expect(second.body.cancelledAt).toBe(first.body.cancelledAt);
  });

  test('[REQ-F-014] повторне скасування не звільняє вдруге місця, які вже забронював інший клієнт', async () => {
    const { ctx, user, booking, session } = await setup(seats([2, 4]));
    const other = await registerAndLogin(ctx.app);
    await cancelBooking(ctx.app, user.token, booking.id);
    const rebooked = await book(ctx.app, other.token, { sessionId: session.sessionId, seats: seats([2, 4]) });

    const repeat = await cancelBooking(ctx.app, user.token, booking.id);
    const map = await seatMap(ctx.app, session.sessionId);

    expect(repeat.status).toBe(200);
    expect(seatStatus(map, 2, 4)).toBe('TAKEN');
    expect(bookingRow(ctx.db, rebooked.body.id).status).toBe('ACTIVE');
  });

  test('[REQ-F-014][REQ-F-012] повторне скасування вже скасованого бронювання після початку сеансу теж повертає 200 з поточним станом', async () => {
    const { ctx, user, booking, session } = await setup();
    await cancelBooking(ctx.app, user.token, booking.id);
    ctx.clock.set(new Date(new Date(session.startTime).getTime() + 5 * 60 * 1000));

    const res = await cancelBooking(ctx.app, user.token, booking.id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });
});

describe('POST /bookings/{bookingId}/cancel, межа часу (REQ-F-012)', () => {
  test('[REQ-F-012][REQ-TDD-003][N-14] BDD-сценарій 4, скасування рівно в момент початку сеансу блокується 409 CANCELLATION_DEADLINE_PASSED', async () => {
    const { ctx, user, booking, session } = await setup();
    ctx.clock.set(session.startTime);

    const res = await cancelBooking(ctx.app, user.token, booking.id);
    const map = await seatMap(ctx.app, session.sessionId);

    expect(res.status).toBe(409);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('CANCELLATION_DEADLINE_PASSED');
    expect(bookingRow(ctx.db, booking.id).status).toBe('ACTIVE');
    expect(seatStatus(map, 1, 1)).toBe('TAKEN');
    expect(seatStatus(map, 1, 2)).toBe('TAKEN');
  });

  test('[REQ-F-012][N-15] BDD-сценарій 5, скасування через 15 хвилин після початку блокується, місця не звільняються', async () => {
    const { ctx, user, booking, session } = await setup();
    ctx.clock.set(new Date(new Date(session.startTime).getTime() + 15 * 60 * 1000));

    const res = await cancelBooking(ctx.app, user.token, booking.id);
    const map = await seatMap(ctx.app, session.sessionId);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CANCELLATION_DEADLINE_PASSED');
    expect(bookingRow(ctx.db, booking.id).status).toBe('ACTIVE');
    expect(seatStatus(map, 1, 1)).toBe('TAKEN');
  });
});

describe('POST /bookings/{bookingId}/cancel, доступ і помилки', () => {
  test('[REQ-F-005][REQ-NF-004][ADD-04][N-13] скасування чужого бронювання повертає 403 FORBIDDEN і нічого не змінює', async () => {
    const { ctx, booking, session } = await setup();
    const intruder = await registerAndLogin(ctx.app);

    const res = await cancelBooking(ctx.app, intruder.token, booking.id);
    const map = await seatMap(ctx.app, session.sessionId);

    expect(res.status).toBe(403);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('FORBIDDEN');
    expect(bookingRow(ctx.db, booking.id).status).toBe('ACTIVE');
    expect(seatStatus(map, 1, 1)).toBe('TAKEN');
  });

  test('[REQ-F-005][REQ-NF-004] перебір чужих ID бронювань не розкриває їхній вміст', async () => {
    const { ctx, booking } = await setup();
    const intruder = await registerAndLogin(ctx.app);

    const res = await cancelBooking(ctx.app, intruder.token, booking.id);

    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty('seats');
    expect(res.body).not.toHaveProperty('userId');
  });

  test('[REQ-F-011][N-16] неіснуюче бронювання повертає 404 NOT_FOUND', async () => {
    const { ctx, user } = await setup();

    const res = await cancelBooking(ctx.app, user.token, 9999);

    expect(res.status).toBe(404);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('[REQ-F-006][ADD-10] ADMIN не скасовує бронювання клієнтів, 403 FORBIDDEN', async () => {
    const { ctx, booking } = await setup();
    const admin = await adminLogin(ctx.app);

    const res = await cancelBooking(ctx.app, admin.token, booking.id);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(bookingRow(ctx.db, booking.id).status).toBe('ACTIVE');
  });
});
