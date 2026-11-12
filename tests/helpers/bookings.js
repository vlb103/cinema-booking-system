// Допоміжні функції для тестів раунду 2 (бронювання).
const request = require('supertest');
const { API } = require('./testContext');
const { insertFilm, insertHall, insertSession } = require('./fixtures');

const HOUR = 60 * 60 * 1000;

// Фільм, зал 3 ряди по 8 місць, активний сеанс через 2 години після now.
function seedBookableSession(db, now, { rowsCount = 3, seatsPerRow = 8, startOffsetMs = 2 * HOUR, status = 'ACTIVE', cancellationReason = null } = {}) {
  const filmId = insertFilm(db, { title: 'Interstellar' });
  const hallId = insertHall(db, { name: 'Зал 2', rowsCount, seatsPerRow });
  const startTime = new Date(new Date(now).getTime() + startOffsetMs).toISOString();
  const sessionId = insertSession(db, { filmId, hallId, startTime, status, cancellationReason });
  return { filmId, hallId, sessionId, startTime };
}

function book(app, token, body) {
  const req = request(app).post(`${API}/bookings`);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send(body);
}

function myBookings(app, token, query = '') {
  const req = request(app).get(`${API}/bookings${query}`);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req;
}

async function seatMap(app, sessionId) {
  const res = await request(app).get(`${API}/sessions/${sessionId}/seats`);
  return res.body;
}

function seatStatus(map, row, number) {
  const seat = map.seats.find((s) => s.row === row && s.number === number);
  return seat ? seat.status : undefined;
}

function seats(...pairs) {
  return pairs.map(([row, number]) => ({ row, number }));
}

function count(db, sql, ...params) {
  return db.prepare(sql).get(...params).n;
}

module.exports = { HOUR, seedBookableSession, book, myBookings, seatMap, seatStatus, seats, count };
