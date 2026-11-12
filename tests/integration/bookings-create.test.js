// Раунд 2. Створення бронювання (createBooking).
// Джерела: SRS REQ-F-007, REQ-F-008, REQ-F-009, REQ-F-010, REQ-F-004, REQ-F-013, REQ-NF-001, REQ-NF-006,
// REQ-TDD-003, BDD-сценарії 1 і 2, ADD-02, ADD-06, ADD-09, openapi createBooking і Booking,
// сценарії P-05, P-06, N-04..N-11 з docs/api/scenarios.md, тікети T-24..T-35.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TEST_NOW, createTestContext } = require('../helpers/testContext');
const { registerAndLogin } = require('../helpers/api');
const { insertUser, insertBooking, insertSession } = require('../helpers/fixtures');
const { HOUR, seedBookableSession, book, seatMap, seatStatus, seats, count } = require('../helpers/bookings');
const { openDatabase } = require('../../src/db/connection');

const bookingsCount = (db) => count(db, 'SELECT COUNT(*) AS n FROM bookings');
const activeSeatsCount = (db) => count(db, 'SELECT COUNT(*) AS n FROM booking_seats WHERE active = 1');

describe('POST /bookings, позитивні випадки', () => {
  test('[REQ-F-008][REQ-F-007][REQ-TDD-003][P-05] бронювання 1 місця (мінімум) повертає 201 Booking за контрактом', async () => {
    const ctx = createTestContext();
    const { sessionId, startTime } = seedBookableSession(ctx.db, TEST_NOW);
    const user = await registerAndLogin(ctx.app);

    const res = await book(ctx.app, user.token, { sessionId, seats: seats([1, 1]) });

    expect(res.status).toBe(201);
    expect(res).toSatisfyApiSpec();
    expect(res.body).toMatchObject({
      userId: user.id,
      status: 'ACTIVE',
      seats: [{ row: 1, number: 1 }],
      session: { id: sessionId, status: 'ACTIVE', filmTitle: 'Interstellar', hallName: 'Зал 2' },
      cancelledAt: null,
      cancellationReason: null,
    });
    expect(Number.isInteger(res.body.id)).toBe(true);
    expect(new Date(res.body.session.startTime).toISOString()).toBe(startTime);
    expect(new Date(res.body.createdAt).toISOString()).toBe(TEST_NOW);
  });

  test('[REQ-F-007][REQ-TDD-003][P-06] бронювання 6 місць (максимум) повертає 201', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const user = await registerAndLogin(ctx.app);
    const six = seats([3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6]);

    const res = await book(ctx.app, user.token, { sessionId, seats: six });

    expect(res.status).toBe(201);
    expect(res).toSatisfyApiSpec();
    expect(res.body.seats).toHaveLength(6);
    expect(res.body.seats).toEqual(expect.arrayContaining(six));
  });

  test('[REQ-F-008] після бронювання місця одразу зайняті у схемі залу, інші вільні', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const user = await registerAndLogin(ctx.app);

    await book(ctx.app, user.token, { sessionId, seats: seats([2, 3], [2, 4]) });
    const map = await seatMap(ctx.app, sessionId);

    expect(seatStatus(map, 2, 3)).toBe('TAKEN');
    expect(seatStatus(map, 2, 4)).toBe('TAKEN');
    expect(map.seats.filter((s) => s.status === 'TAKEN')).toHaveLength(2);
  });

  test('[REQ-F-004][REQ-F-008] бронювання зберігається в БД з ID користувача і всіма місцями', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const user = await registerAndLogin(ctx.app);

    const res = await book(ctx.app, user.token, { sessionId, seats: seats([1, 1], [1, 2]) });

    const row = ctx.db.prepare('SELECT user_id, session_id, status FROM bookings WHERE id = ?').get(res.body.id);
    expect(row).toEqual({ user_id: user.id, session_id: sessionId, status: 'ACTIVE' });
    expect(count(ctx.db, 'SELECT COUNT(*) AS n FROM booking_seats WHERE booking_id = ? AND active = 1', res.body.id)).toBe(2);
  });

  test('[REQ-F-009] два користувачі бронюють різні місця одного сеансу, обидва успішні', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const a = await registerAndLogin(ctx.app);
    const b = await registerAndLogin(ctx.app);

    const ra = await book(ctx.app, a.token, { sessionId, seats: seats([1, 1]) });
    const rb = await book(ctx.app, b.token, { sessionId, seats: seats([1, 2]) });

    expect(ra.status).toBe(201);
    expect(rb.status).toBe(201);
    expect(rb.body.id).not.toBe(ra.body.id);
  });

  test('[REQ-F-009] те саме місце на іншому сеансі вільне і бронюється', async () => {
    const ctx = createTestContext();
    const { sessionId, filmId, hallId } = seedBookableSession(ctx.db, TEST_NOW);
    const other = insertSession(ctx.db, { filmId, hallId, startTime: new Date(new Date(TEST_NOW).getTime() + 5 * HOUR) });
    const user = await registerAndLogin(ctx.app);
    await book(ctx.app, user.token, { sessionId, seats: seats([1, 1]) });

    const res = await book(ctx.app, user.token, { sessionId: other, seats: seats([1, 1]) });

    expect(res.status).toBe(201);
  });

  test('[REQ-F-013][REQ-F-008] місце зі скасованого бронювання можна забронювати знову', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    insertBooking(ctx.db, { userId: insertUser(ctx.db), sessionId, seats: seats([1, 1]), status: 'CANCELLED' });
    const user = await registerAndLogin(ctx.app);

    const res = await book(ctx.app, user.token, { sessionId, seats: seats([1, 1]) });

    expect(res.status).toBe(201);
  });

  test('[REQ-F-008][ADD-06] граничний випадок, сеанс починається через 1 секунду, бронювання дозволене', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW, { startOffsetMs: 1000 });
    const user = await registerAndLogin(ctx.app);

    const res = await book(ctx.app, user.token, { sessionId, seats: seats([1, 1]) });

    expect(res.status).toBe(201);
  });

  test('[REQ-F-007][ADD-09] граничні місця схеми залу (перше і останнє) бронюються', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW, { rowsCount: 3, seatsPerRow: 8 });
    const user = await registerAndLogin(ctx.app);

    const res = await book(ctx.app, user.token, { sessionId, seats: seats([1, 1], [3, 8]) });

    expect(res.status).toBe(201);
  });
});

describe('POST /bookings, валідація місць (400 VALIDATION_ERROR)', () => {
  test.each([
    ['[REQ-F-007][REQ-TDD-003][N-04] 0 місць', () => []],
    ['[REQ-F-007][REQ-TDD-003][N-05] 7 місць', () => seats([1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7])],
    ['[REQ-F-007][ADD-09][N-06] одне місце двічі', () => seats([1, 1], [1, 1])],
    ['[REQ-F-007][ADD-09][N-07] ряд поза схемою залу', () => seats([99, 1])],
    ['[REQ-F-007][ADD-09] номер місця поза схемою залу', () => seats([1, 9])],
    ['[REQ-F-007][ADD-09] ряд, наступний за останнім', () => seats([4, 1])],
    ['[REQ-F-007][ADD-02] ряд 0 (нумерація з 1)', () => seats([0, 1])],
    ['[REQ-F-007][ADD-02] номер місця 0 (нумерація з 1)', () => seats([1, 0])],
    ['[REQ-F-007][ADD-02] ряд не ціле число', () => [{ row: 1.5, number: 1 }]],
    ['[REQ-F-007][ADD-02] місце без номера', () => [{ row: 1 }]],
    ['[REQ-F-007][ADD-02] місце числом замість пари ряд і номер', () => [5]],
  ])('%s відхиляється, бронювання не створюється', async (_name, makeSeats) => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const user = await registerAndLogin(ctx.app);

    const res = await book(ctx.app, user.token, { sessionId, seats: makeSeats() });

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(bookingsCount(ctx.db)).toBe(0);
    expect(activeSeatsCount(ctx.db)).toBe(0);
  });

  test.each([
    ['без seats', (sessionId) => ({ sessionId })],
    ['без sessionId', () => ({ seats: seats([1, 1]) })],
    ['seats не масив', (sessionId) => ({ sessionId, seats: { row: 1, number: 1 } })],
    ['sessionId рядком', (sessionId) => ({ sessionId: String(sessionId), seats: seats([1, 1]) })],
    ['порожнє тіло', () => ({})],
  ])('[REQ-F-007][ADD-03] запит %s відхиляється 400 VALIDATION_ERROR', async (_name, makeBody) => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const user = await registerAndLogin(ctx.app);

    const res = await book(ctx.app, user.token, makeBody(sessionId));

    expect(res.status).toBe(400);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(bookingsCount(ctx.db)).toBe(0);
  });
});

describe('POST /bookings, недоступний сеанс', () => {
  test('[REQ-F-008][ADD-06][N-11] неіснуючий сеанс повертає 404 NOT_FOUND', async () => {
    const ctx = createTestContext();
    const user = await registerAndLogin(ctx.app);

    const res = await book(ctx.app, user.token, { sessionId: 9999, seats: seats([1, 1]) });

    expect(res.status).toBe(404);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('NOT_FOUND');
    expect(bookingsCount(ctx.db)).toBe(0);
  });

  test('[REQ-F-008][REQ-F-018][ADD-06][N-10] скасований сеанс повертає 409 SESSION_NOT_AVAILABLE', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW, { status: 'CANCELLED', cancellationReason: 'Аварійне відключення живлення' });
    const user = await registerAndLogin(ctx.app);

    const res = await book(ctx.app, user.token, { sessionId, seats: seats([1, 1]) });

    expect(res.status).toBe(409);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('SESSION_NOT_AVAILABLE');
    expect(bookingsCount(ctx.db)).toBe(0);
  });

  test('[REQ-F-008][ADD-06][N-10] граничний випадок, сеанс починається рівно зараз, 409 SESSION_NOT_AVAILABLE', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW, { startOffsetMs: 0 });
    const user = await registerAndLogin(ctx.app);

    const res = await book(ctx.app, user.token, { sessionId, seats: seats([1, 1]) });

    expect(res.status).toBe(409);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('SESSION_NOT_AVAILABLE');
  });

  test('[REQ-F-008][ADD-06][N-10] сеанс, що вже йде, повертає 409 SESSION_NOT_AVAILABLE', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW, { startOffsetMs: -15 * 60 * 1000 });
    const user = await registerAndLogin(ctx.app);

    const res = await book(ctx.app, user.token, { sessionId, seats: seats([1, 1]) });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SESSION_NOT_AVAILABLE');
    expect(bookingsCount(ctx.db)).toBe(0);
  });
});

describe('POST /bookings, зайняті місця', () => {
  test('[REQ-F-009][N-08] місце вже заброньоване іншим клієнтом, 409 SEATS_TAKEN із зазначенням місця', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const first = await registerAndLogin(ctx.app);
    const second = await registerAndLogin(ctx.app);
    await book(ctx.app, first.token, { sessionId, seats: seats([2, 4]) });

    const res = await book(ctx.app, second.token, { sessionId, seats: seats([2, 4]) });

    expect(res.status).toBe(409);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('SEATS_TAKEN');
    expect(res.body.details.join(' ')).toMatch(/ряд 2, місце 4/);
    expect(bookingsCount(ctx.db)).toBe(1);
  });

  test('[REQ-F-009] той самий користувач не може вдруге забронювати своє ж місце', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const user = await registerAndLogin(ctx.app);
    await book(ctx.app, user.token, { sessionId, seats: seats([1, 1]) });

    const res = await book(ctx.app, user.token, { sessionId, seats: seats([1, 1]) });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SEATS_TAKEN');
  });

  test('[REQ-F-010][REQ-NF-001][REQ-TDD-003][N-09] BDD-сценарій 2, місця 5 і 6 вільні, 7 зайняте, бронювання [5, 6, 7] відхиляється повністю', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const other = await registerAndLogin(ctx.app);
    const user = await registerAndLogin(ctx.app);
    await book(ctx.app, other.token, { sessionId, seats: seats([1, 7]) });

    const res = await book(ctx.app, user.token, { sessionId, seats: seats([1, 5], [1, 6], [1, 7]) });

    expect(res.status).toBe(409);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('SEATS_TAKEN');
    expect(count(ctx.db, 'SELECT COUNT(*) AS n FROM bookings WHERE user_id = ?', user.id)).toBe(0);
    const map = await seatMap(ctx.app, sessionId);
    expect(seatStatus(map, 1, 5)).toBe('FREE');
    expect(seatStatus(map, 1, 6)).toBe('FREE');
    expect(seatStatus(map, 1, 7)).toBe('TAKEN');
  });

  test('[REQ-F-010][REQ-NF-001] після відмови вільні місця групи одразу доступні іншому клієнту', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const holder = await registerAndLogin(ctx.app);
    const loser = await registerAndLogin(ctx.app);
    const third = await registerAndLogin(ctx.app);
    await book(ctx.app, holder.token, { sessionId, seats: seats([1, 7]) });
    await book(ctx.app, loser.token, { sessionId, seats: seats([1, 5], [1, 6], [1, 7]) });

    const res = await book(ctx.app, third.token, { sessionId, seats: seats([1, 5], [1, 6]) });

    expect(res.status).toBe(201);
  });

  test('[REQ-F-010] у відповіді SEATS_TAKEN перелічено лише зайняті місця', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const holder = await registerAndLogin(ctx.app);
    const user = await registerAndLogin(ctx.app);
    await book(ctx.app, holder.token, { sessionId, seats: seats([1, 7], [1, 8]) });

    const res = await book(ctx.app, user.token, { sessionId, seats: seats([1, 6], [1, 7], [1, 8]) });

    expect(res.status).toBe(409);
    const text = res.body.details.join(' | ');
    expect(text).toMatch(/ряд 1, місце 7/);
    expect(text).toMatch(/ряд 1, місце 8/);
    expect(text).not.toMatch(/ряд 1, місце 6/);
  });
});

describe('POST /bookings, конкурентні запити', () => {
  test('[REQ-F-009][REQ-NF-006][REQ-TDD-003][REQ-F-008] BDD-сценарій 1, 10 одночасних запитів на одне місце дають рівно 1 успіх і 9 SEATS_TAKEN', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const users = [];
    for (let i = 0; i < 10; i += 1) users.push(await registerAndLogin(ctx.app));

    const results = await Promise.all(users.map((u) => book(ctx.app, u.token, { sessionId, seats: seats([2, 4]) })));

    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    for (const r of results.filter((x) => x.status === 409)) expect(r.body.code).toBe('SEATS_TAKEN');
    expect(count(ctx.db, 'SELECT COUNT(*) AS n FROM booking_seats WHERE session_id = ? AND seat_row = 2 AND seat_number = 4 AND active = 1', sessionId)).toBe(1);
    expect(bookingsCount(ctx.db)).toBe(1);
  });

  test('[REQ-F-009][REQ-F-008] після конкурентної гонки місце лишається зайнятим і не допускає повторного бронювання', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const a = await registerAndLogin(ctx.app);
    const b = await registerAndLogin(ctx.app);
    const c = await registerAndLogin(ctx.app);
    await Promise.all([a, b].map((u) => book(ctx.app, u.token, { sessionId, seats: seats([2, 4]) })));

    const late = await book(ctx.app, c.token, { sessionId, seats: seats([2, 4]) });
    const map = await seatMap(ctx.app, sessionId);

    expect(late.status).toBe(409);
    expect(late.body.code).toBe('SEATS_TAKEN');
    expect(seatStatus(map, 2, 4)).toBe('TAKEN');
  });

  test('[REQ-F-010][REQ-NF-001][REQ-NF-006] одночасні групові запити зі спільним місцем, успішний лише один, решта місць невдалих груп вільні', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const users = [];
    for (let i = 0; i < 5; i += 1) users.push(await registerAndLogin(ctx.app));

    // Кожен просить спільне місце 1-1 і своє місце в ряду 2.
    const results = await Promise.all(users.map((u, i) => book(ctx.app, u.token, { sessionId, seats: seats([1, 1], [2, i + 1]) })));

    const winners = results.filter((r) => r.status === 201);
    expect(winners).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    const map = await seatMap(ctx.app, sessionId);
    const takenInRow2 = map.seats.filter((s) => s.row === 2 && s.status === 'TAKEN');
    expect(takenInRow2).toHaveLength(1);
    expect(activeSeatsCount(ctx.db)).toBe(2);
  });

  test('[REQ-NF-006][REQ-F-009] два екземпляри сервера з окремими з\'єднаннями до однієї БД, 10 одночасних запитів дають 1 успіх і без збоїв', async () => {
    const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cbs-db-')), 'cinema.db');
    const db1 = openDatabase(dbPath);
    const db2 = openDatabase(dbPath);
    const s1 = createTestContext({ db: db1 });
    const s2 = createTestContext({ db: db2, logFilePath: s1.logFilePath });
    const { sessionId } = seedBookableSession(db1, TEST_NOW);
    const users = [];
    for (let i = 0; i < 10; i += 1) users.push(await registerAndLogin(s1.app));

    const results = await Promise.all(users.map((u, i) => book(i % 2 ? s2.app : s1.app, u.token, { sessionId, seats: seats([2, 4]) })));

    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    expect(statuses.filter((s) => s >= 500)).toHaveLength(0);
    expect(count(db1, 'SELECT COUNT(*) AS n FROM booking_seats WHERE active = 1')).toBe(1);
    db1.close();
    db2.close();
  });
});

describe('POST /bookings, атомарність при збої (REQ-NF-001)', () => {
  test('[REQ-NF-001][REQ-F-008] збій під час запису місць відкатує транзакцію, часткових записів немає', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBookableSession(ctx.db, TEST_NOW);
    const user = await registerAndLogin(ctx.app);
    // Імітація збою сховища на записі другого місця.
    ctx.db.exec(`CREATE TRIGGER simulate_failure BEFORE INSERT ON booking_seats
                 WHEN NEW.seat_row = 2 AND NEW.seat_number = 3
                 BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END;`);

    const res = await book(ctx.app, user.token, { sessionId, seats: seats([1, 1], [2, 3]) });

    expect(res.status).toBe(500);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(bookingsCount(ctx.db)).toBe(0);
    expect(count(ctx.db, 'SELECT COUNT(*) AS n FROM booking_seats')).toBe(0);
  });
});
