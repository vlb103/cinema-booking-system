// Раунд 1. Публічна афіша і схема залу.
// Джерела: SRS REQ-F-001, REQ-F-002, REQ-F-013, ADD-12, openapi listSessions і getSessionSeatMap,
// сценарії P-01, P-02, N-17 з docs/api/scenarios.md, тікети T-06, T-08.
const request = require('supertest');
const { API, TEST_NOW, createTestContext } = require('../helpers/testContext');
const { insertFilm, insertHall, insertSession, insertUser, insertBooking, seedBasicSession } = require('../helpers/fixtures');

const HOUR = 60 * 60 * 1000;
const at = (offsetMs) => new Date(new Date(TEST_NOW).getTime() + offsetMs).toISOString();

describe('GET /sessions (listSessions)', () => {
  test('[REQ-F-001][T-06][P-01] афіша доступна без токена, відповідь за контрактом SessionListItem[]', async () => {
    const ctx = createTestContext();
    const filmId = insertFilm(ctx.db, { title: 'Interstellar', durationMinutes: 169, description: 'Про космос' });
    const hallId = insertHall(ctx.db, { name: 'Зал 2', rowsCount: 2, seatsPerRow: 3 });
    const sessionId = insertSession(ctx.db, { filmId, hallId, startTime: at(2 * HOUR) });

    const res = await request(ctx.app).get(`${API}/sessions`);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body).toHaveLength(1);
    const item = res.body[0];
    expect(item).toMatchObject({
      id: sessionId,
      status: 'ACTIVE',
      film: { id: filmId, title: 'Interstellar', durationMinutes: 169, description: 'Про космос' },
      hall: { id: hallId, name: 'Зал 2' },
    });
    expect(new Date(item.startTime).toISOString()).toBe(at(2 * HOUR));
  });

  test('[REQ-F-001] порожній розклад повертає 200 і порожній масив', async () => {
    const ctx = createTestContext();

    const res = await request(ctx.app).get(`${API}/sessions`);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body).toEqual([]);
  });

  test('[REQ-F-001] повертається повний список активних майбутніх сеансів (кілька фільмів і залів)', async () => {
    const ctx = createTestContext();
    const f1 = insertFilm(ctx.db, { title: 'Interstellar' });
    const f2 = insertFilm(ctx.db, { title: 'The Matrix', durationMinutes: 136 });
    const h1 = insertHall(ctx.db, { name: 'Зал 1' });
    const h2 = insertHall(ctx.db, { name: 'Зал 2' });
    const ids = [
      insertSession(ctx.db, { filmId: f1, hallId: h1, startTime: at(1 * HOUR) }),
      insertSession(ctx.db, { filmId: f2, hallId: h2, startTime: at(3 * HOUR) }),
      insertSession(ctx.db, { filmId: f1, hallId: h2, startTime: at(26 * HOUR) }),
    ];

    const res = await request(ctx.app).get(`${API}/sessions`);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body.map((s) => s.id).sort()).toEqual([...ids].sort());
  });

  test('[REQ-F-001][ADD-12] скасований сеанс не входить в афішу', async () => {
    const ctx = createTestContext();
    const filmId = insertFilm(ctx.db);
    const hallId = insertHall(ctx.db);
    const active = insertSession(ctx.db, { filmId, hallId, startTime: at(2 * HOUR) });
    insertSession(ctx.db, { filmId, hallId, startTime: at(3 * HOUR), status: 'CANCELLED', cancellationReason: 'Аварія' });

    const res = await request(ctx.app).get(`${API}/sessions`);

    expect(res.status).toBe(200);
    expect(res.body.map((s) => s.id)).toEqual([active]);
  });

  test('[REQ-F-001][ADD-12] сеанс, що вже почався або минув, не входить в афішу', async () => {
    const ctx = createTestContext();
    const filmId = insertFilm(ctx.db);
    const hallId = insertHall(ctx.db);
    insertSession(ctx.db, { filmId, hallId, startTime: at(-30 * 60 * 1000) });
    insertSession(ctx.db, { filmId, hallId, startTime: at(-24 * HOUR) });

    const res = await request(ctx.app).get(`${API}/sessions`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('[REQ-F-001][ADD-12] граничний випадок, сеанс з початком рівно зараз не показується, за 1 секунду до початку показується', async () => {
    const ctx = createTestContext();
    const filmId = insertFilm(ctx.db);
    const hallId = insertHall(ctx.db);
    insertSession(ctx.db, { filmId, hallId, startTime: at(0) });
    const soon = insertSession(ctx.db, { filmId, hallId, startTime: at(1000) });

    const res = await request(ctx.app).get(`${API}/sessions`);

    expect(res.status).toBe(200);
    expect(res.body.map((s) => s.id)).toEqual([soon]);
  });

  test('[REQ-F-001][ADD-12] афіша рахує «зараз» за годинником сервера', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBasicSession(ctx.db, TEST_NOW);

    const before = await request(ctx.app).get(`${API}/sessions`);
    ctx.clock.advance(2 * HOUR);
    const after = await request(ctx.app).get(`${API}/sessions`);

    expect(before.status).toBe(200);
    expect(before.body.map((s) => s.id)).toEqual([sessionId]);
    expect(after.status).toBe(200);
    expect(after.body).toEqual([]);
  });
});

describe('GET /sessions/{sessionId}/seats (getSessionSeatMap)', () => {
  test('[REQ-F-002][T-08][P-02] схема залу доступна без токена, усі місця залу, місткість рахує сервер', async () => {
    const ctx = createTestContext();
    const { sessionId, hallId } = seedBasicSession(ctx.db, TEST_NOW);

    const res = await request(ctx.app).get(`${API}/sessions/${sessionId}/seats`);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body).toMatchObject({
      sessionId,
      sessionStatus: 'ACTIVE',
      hall: { id: hallId, name: 'Зал 2', rowsCount: 2, seatsPerRow: 3, capacity: 6 },
    });
    const seats = res.body.seats.map((s) => `${s.row}-${s.number}`).sort();
    expect(seats).toEqual(['1-1', '1-2', '1-3', '2-1', '2-2', '2-3']);
    expect(res.body.seats.every((s) => s.status === 'FREE')).toBe(true);
  });

  test('[REQ-F-002] місця активного бронювання мають статус TAKEN, решта FREE', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBasicSession(ctx.db, TEST_NOW);
    const userId = insertUser(ctx.db);
    insertBooking(ctx.db, { userId, sessionId, seats: [{ row: 1, number: 3 }, { row: 2, number: 2 }] });

    const res = await request(ctx.app).get(`${API}/sessions/${sessionId}/seats`);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    const taken = res.body.seats.filter((s) => s.status === 'TAKEN').map((s) => `${s.row}-${s.number}`).sort();
    expect(taken).toEqual(['1-3', '2-2']);
    expect(res.body.seats.filter((s) => s.status === 'FREE')).toHaveLength(4);
  });

  test('[REQ-F-002][REQ-F-013] місця скасованого бронювання показуються як FREE', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBasicSession(ctx.db, TEST_NOW);
    const userId = insertUser(ctx.db);
    insertBooking(ctx.db, { userId, sessionId, seats: [{ row: 1, number: 1 }], status: 'CANCELLED' });

    const res = await request(ctx.app).get(`${API}/sessions/${sessionId}/seats`);

    expect(res.status).toBe(200);
    const seat = res.body.seats.find((s) => s.row === 1 && s.number === 1);
    expect(seat).toEqual({ row: 1, number: 1, status: 'FREE' });
  });

  test('[REQ-F-002] бронювання іншого сеансу в тому самому залі не робить місця зайнятими', async () => {
    const ctx = createTestContext();
    const { sessionId, filmId, hallId } = seedBasicSession(ctx.db, TEST_NOW);
    const other = insertSession(ctx.db, { filmId, hallId, startTime: at(5 * HOUR) });
    const userId = insertUser(ctx.db);
    insertBooking(ctx.db, { userId, sessionId: other, seats: [{ row: 1, number: 1 }] });

    const res = await request(ctx.app).get(`${API}/sessions/${sessionId}/seats`);

    expect(res.status).toBe(200);
    expect(res.body.seats.every((s) => s.status === 'FREE')).toBe(true);
  });

  test('[REQ-F-002] перегляд схеми клієнтом А не змінює стан місць для клієнта Б (немає hold)', async () => {
    const ctx = createTestContext();
    const { sessionId } = seedBasicSession(ctx.db, TEST_NOW);

    const clientA = await request(ctx.app).get(`${API}/sessions/${sessionId}/seats`);
    const clientB = await request(ctx.app).get(`${API}/sessions/${sessionId}/seats`);

    expect(clientA.status).toBe(200);
    expect(clientB.status).toBe(200);
    expect(clientB.body).toEqual(clientA.body);
    expect(ctx.db.prepare('SELECT COUNT(*) AS n FROM booking_seats').get().n).toBe(0);
  });

  test('[REQ-F-002][ADD-12] схема скасованого сеансу повертається разом зі статусом CANCELLED', async () => {
    const ctx = createTestContext();
    const filmId = insertFilm(ctx.db);
    const hallId = insertHall(ctx.db);
    const sessionId = insertSession(ctx.db, { filmId, hallId, startTime: at(2 * HOUR), status: 'CANCELLED', cancellationReason: 'Аварія' });

    const res = await request(ctx.app).get(`${API}/sessions/${sessionId}/seats`);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body.sessionStatus).toBe('CANCELLED');
  });

  test('[REQ-F-002][ADD-12] схема сеансу, що вже почався, теж доступна', async () => {
    const ctx = createTestContext();
    const filmId = insertFilm(ctx.db);
    const hallId = insertHall(ctx.db);
    const sessionId = insertSession(ctx.db, { filmId, hallId, startTime: at(-10 * 60 * 1000) });

    const res = await request(ctx.app).get(`${API}/sessions/${sessionId}/seats`);

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
    expect(res.body.sessionId).toBe(sessionId);
  });

  test('[REQ-F-002][N-17][ADD-03] неіснуючий сеанс повертає 404 NOT_FOUND у моделі Error', async () => {
    const ctx = createTestContext();

    const res = await request(ctx.app).get(`${API}/sessions/9999/seats`);

    expect(res.status).toBe(404);
    expect(res).toSatisfyApiSpec();
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
