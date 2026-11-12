// Раунд 2. Логування бронювань і відмов.
// Джерела: SRS REQ-LOG-001 (п.1 створення бронювання, п.4 відмови через зайнятість і бізнес-правила, п.5 збої),
// REQ-LOG-002 (поля, entity_ids з сеансом, бронюванням і місцями), REQ-LOG-003, тікети T-58, T-60, T-62.
const { TEST_NOW, createTestContext } = require('../helpers/testContext');
const { registerAndLogin } = require('../helpers/api');
const { seedBookableSession, book, myBookings, seats } = require('../helpers/bookings');

const REQUIRED_FIELDS = ['timestamp', 'event_type', 'status', 'user_id', 'entity_ids', 'reason'];

function events(ctx, eventType, status) {
  return ctx.readLog().filter((e) => e.event_type === eventType && e.status === status);
}

describe('Логування створення бронювань', () => {
  test('[REQ-LOG-001][REQ-LOG-002][T-58] успішне бронювання записується як BOOKING_CREATED SUCCESS з користувачем, сеансом, бронюванням і місцями', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const user = await registerAndLogin(ctx.app);

    const res = await book(ctx.app, user.token, { sessionId, seats: seats([1, 1], [1, 2]) });

    const found = events(ctx, 'BOOKING_CREATED', 'SUCCESS');
    expect(found).toHaveLength(1);
    expect(found[0].user_id).toBe(user.id);
    expect(found[0].entity_ids).toMatchObject({ sessionId, bookingId: res.body.id });
    expect(found[0].entity_ids.seats).toEqual(expect.arrayContaining(seats([1, 1], [1, 2])));
  });

  test('[REQ-LOG-001][T-58] відмова через зайняте місце записується як BOOKING_CREATED REJECTED з причиною і місцями', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const first = await registerAndLogin(ctx.app);
    const second = await registerAndLogin(ctx.app);
    await book(ctx.app, first.token, { sessionId, seats: seats([2, 4]) });

    await book(ctx.app, second.token, { sessionId, seats: seats([2, 3], [2, 4]) });

    const found = events(ctx, 'BOOKING_CREATED', 'REJECTED');
    expect(found).toHaveLength(1);
    expect(found[0].user_id).toBe(second.id);
    expect(found[0].entity_ids).toMatchObject({ sessionId });
    expect(found[0].entity_ids.seats).toEqual(expect.arrayContaining(seats([2, 3], [2, 4])));
    expect(found[0].reason).toEqual(expect.any(String));
    expect(found[0].reason.length).toBeGreaterThan(0);
  });

  test.each([
    ['7 місць', (sid) => ({ sessionId: sid, seats: seats([1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7]) })],
    ['місце поза схемою', (sid) => ({ sessionId: sid, seats: seats([99, 1]) })],
    ['неіснуючий сеанс', () => ({ sessionId: 9999, seats: seats([1, 1]) })],
  ])('[REQ-LOG-001][T-58] відмова через порушення правил (%s) записується як BOOKING_CREATED REJECTED', async (_name, makeBody) => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const user = await registerAndLogin(ctx.app);

    await book(ctx.app, user.token, makeBody(sessionId));

    const found = events(ctx, 'BOOKING_CREATED', 'REJECTED');
    expect(found).toHaveLength(1);
    expect(found[0].user_id).toBe(user.id);
    expect(found[0].reason).toEqual(expect.any(String));
  });

  test('[REQ-LOG-001][T-58] відмова через недоступний (скасований) сеанс записується як BOOKING_CREATED REJECTED', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW, { status: 'CANCELLED', cancellationReason: 'Аварія' });
    const user = await registerAndLogin(ctx.app);

    await book(ctx.app, user.token, { sessionId, seats: seats([1, 1]) });

    const found = events(ctx, 'BOOKING_CREATED', 'REJECTED');
    expect(found).toHaveLength(1);
    expect(found[0].entity_ids).toMatchObject({ sessionId });
  });

  test('[REQ-LOG-001][REQ-F-009][T-58] конкурентна гонка 10 запитів дає в лозі 1 SUCCESS і 9 REJECTED', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const users = [];
    for (let i = 0; i < 10; i += 1) users.push(await registerAndLogin(ctx.app));

    await Promise.all(users.map((u) => book(ctx.app, u.token, { sessionId, seats: seats([2, 4]) })));

    expect(events(ctx, 'BOOKING_CREATED', 'SUCCESS')).toHaveLength(1);
    expect(events(ctx, 'BOOKING_CREATED', 'REJECTED')).toHaveLength(9);
  });

  test('[REQ-LOG-001][REQ-NF-001][T-58] збій запису бронювання записується як SYSTEM_ERROR ERROR, без BOOKING_CREATED SUCCESS', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const user = await registerAndLogin(ctx.app);
    ctx.db.exec(`CREATE TRIGGER simulate_failure BEFORE INSERT ON booking_seats
                 BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END;`);

    await book(ctx.app, user.token, { sessionId, seats: seats([1, 1]) });

    expect(events(ctx, 'SYSTEM_ERROR', 'ERROR')).toHaveLength(1);
    expect(events(ctx, 'BOOKING_CREATED', 'SUCCESS')).toHaveLength(0);
  });

  test('[REQ-LOG-002][T-60] усі записи бронювань мають шість обов\'язкових полів', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const a = await registerAndLogin(ctx.app);
    const b = await registerAndLogin(ctx.app);
    await book(ctx.app, a.token, { sessionId, seats: seats([1, 1]) });
    await book(ctx.app, b.token, { sessionId, seats: seats([1, 1]) });
    await book(ctx.app, b.token, { sessionId, seats: [] });

    const bookingEvents = ctx.readLog().filter((e) => e.event_type === 'BOOKING_CREATED');

    expect(bookingEvents).toHaveLength(3);
    for (const e of bookingEvents) {
      for (const field of REQUIRED_FIELDS) expect(e).toHaveProperty(field);
      expect(Number.isInteger(e.user_id)).toBe(true);
    }
  });

  test('[REQ-LOG-003][T-62] після бронювань і перегляду кабінету в лозі немає токенів і паролів', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const user = await registerAndLogin(ctx.app, { password: 'BookingSecret777' });
    await book(ctx.app, user.token, { sessionId, seats: seats([1, 1]) });
    await book(ctx.app, user.token, { sessionId, seats: seats([1, 1]) });
    await myBookings(ctx.app, user.token);

    const raw = ctx.readLogRaw();

    expect(ctx.readLog().filter((e) => e.event_type === 'BOOKING_CREATED')).toHaveLength(2);
    expect(raw).not.toContain(user.token);
    expect(raw).not.toContain('BookingSecret777');
  });
});
