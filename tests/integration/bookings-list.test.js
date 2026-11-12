// Раунд 2. Перегляд власних бронювань, кабінет (listMyBookings).
// Джерела: SRS REQ-F-020, REQ-F-005, REQ-NF-004, REQ-F-019, §3.1 п.4, BDD-сценарій 6 (кабінет),
// openapi listMyBookings і Booking, сценарії P-07, P-18, тікети T-20, T-22, T-55.
// Анонім (401) і ADMIN (403) для GET /bookings перевіряються в rbac.test.js раунду 1.
const { TEST_NOW, createTestContext } = require('../helpers/testContext');
const { registerAndLogin } = require('../helpers/api');
const { insertBooking } = require('../helpers/fixtures');
const { seedBookableSession, book, myBookings, seats } = require('../helpers/bookings');

describe('GET /bookings (listMyBookings)', () => {
  test('[REQ-F-020][P-07] користувач без бронювань отримує 200 і порожній масив', async () => {
    const ctx = createTestContext();
    const user = await registerAndLogin(ctx.app);

    const res = await myBookings(ctx.app, user.token);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body).toEqual([]);
  });

  test('[REQ-F-020][P-07] створене бронювання видно в кабінеті з даними сеансу за контрактом Booking', async () => {
    const ctx = createTestContext();
    const { sessionId, startTime } = seedBookableSession(ctx.db, TEST_NOW);
    const user = await registerAndLogin(ctx.app);
    const created = await book(ctx.app, user.token, { sessionId, seats: seats([1, 1], [1, 2]) });

    const res = await myBookings(ctx.app, user.token);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: created.body.id,
      userId: user.id,
      status: 'ACTIVE',
      session: { id: sessionId, status: 'ACTIVE', filmTitle: 'Interstellar', hallName: 'Зал 2' },
      cancelledAt: null,
      cancellationReason: null,
    });
    expect(res.body[0].seats).toEqual(expect.arrayContaining(seats([1, 1], [1, 2])));
    expect(res.body[0].seats).toHaveLength(2);
    expect(new Date(res.body[0].session.startTime).toISOString()).toBe(startTime);
  });

  test('[REQ-F-020] кабінет показує всі бронювання користувача на різні сеанси', async () => {
    const ctx = createTestContext();
    const s1 = seedBookableSession(ctx.db, TEST_NOW);
    const s2 = seedBookableSession(ctx.db, TEST_NOW, { startOffsetMs: 5 * 60 * 60 * 1000 });
    const user = await registerAndLogin(ctx.app);
    const b1 = await book(ctx.app, user.token, { sessionId: s1.sessionId, seats: seats([1, 1]) });
    const b2 = await book(ctx.app, user.token, { sessionId: s2.sessionId, seats: seats([2, 2]) });

    const res = await myBookings(ctx.app, user.token);

    expect(res.status).toBe(200);
    expect(res.body.map((b) => b.id).sort()).toEqual([b1.body.id, b2.body.id].sort());
  });

  test('[REQ-F-005][REQ-NF-004][T-20][T-22] користувач бачить лише власні бронювання', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const alice = await registerAndLogin(ctx.app);
    const bob = await registerAndLogin(ctx.app);
    const own = await book(ctx.app, alice.token, { sessionId, seats: seats([1, 1]) });
    await book(ctx.app, bob.token, { sessionId, seats: seats([1, 2]) });

    const res = await myBookings(ctx.app, alice.token);

    expect(res.status).toBe(200);
    expect(res.body.map((b) => b.id)).toEqual([own.body.id]);
    expect(res.body.every((b) => b.userId === alice.id)).toBe(true);
  });

  test('[REQ-NF-004][REQ-NF-003][T-22] підміна ID користувача в параметрах запиту не дає доступу до чужих бронювань', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const alice = await registerAndLogin(ctx.app);
    const bob = await registerAndLogin(ctx.app);
    await book(ctx.app, bob.token, { sessionId, seats: seats([1, 2]) });

    const res = await myBookings(ctx.app, alice.token, `?userId=${bob.id}&user_id=${bob.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('[REQ-F-020][§3.1] скасоване самим користувачем бронювання показується зі статусом CANCELLED без причини сеансу', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const user = await registerAndLogin(ctx.app);
    insertBooking(ctx.db, { userId: user.id, sessionId, seats: seats([3, 3]), status: 'CANCELLED' });

    const res = await myBookings(ctx.app, user.token);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('CANCELLED');
    expect(res.body[0].cancelledAt).not.toBeNull();
    expect(res.body[0].cancellationReason).toBeNull();
    expect(res.body[0].seats).toEqual([{ row: 3, number: 3 }]);
  });

  test('[REQ-F-020][REQ-F-019][P-18] бронювання скасованого адміністратором сеансу показується з причиною скасування', async () => {
    const ctx = createTestContext();
    const reason = 'Аварійне відключення живлення';
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW, { status: 'CANCELLED', cancellationReason: reason });
    const user = await registerAndLogin(ctx.app);
    const bookingId = insertBooking(ctx.db, { userId: user.id, sessionId, seats: seats([4, 7]), status: 'CANCELLED' });
    ctx.db.prepare('UPDATE bookings SET cancellation_reason = ? WHERE id = ?').run(reason, bookingId);

    const res = await myBookings(ctx.app, user.token);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body[0]).toMatchObject({ id: bookingId, status: 'CANCELLED', cancellationReason: reason, session: { id: sessionId, status: 'CANCELLED' } });
  });

  test('[REQ-F-020] кабінет не змінює стан, повторний запит повертає те саме', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const user = await registerAndLogin(ctx.app);
    await book(ctx.app, user.token, { sessionId, seats: seats([1, 1]) });

    const first = await myBookings(ctx.app, user.token);
    const second = await myBookings(ctx.app, user.token);

    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });
});
