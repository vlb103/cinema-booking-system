// Початкові дані для тестів. Записуються напряму в БД, щоб тести одного
// раунду не залежали від ще не реалізованих операцій інших раундів.
function insertFilm(db, { title = 'Interstellar', durationMinutes = 169, description = 'Науково-фантастичний фільм' } = {}) {
  return Number(db.prepare('INSERT INTO films (title, duration_minutes, description) VALUES (?, ?, ?)')
    .run(title, durationMinutes, description).lastInsertRowid);
}

function insertHall(db, { name = 'Зал 2', rowsCount = 2, seatsPerRow = 3 } = {}) {
  return Number(db.prepare('INSERT INTO halls (name, rows_count, seats_per_row) VALUES (?, ?, ?)')
    .run(name, rowsCount, seatsPerRow).lastInsertRowid);
}

function insertSession(db, { filmId, hallId, startTime, status = 'ACTIVE', cancellationReason = null }) {
  return Number(db.prepare('INSERT INTO sessions (film_id, hall_id, start_time, status, cancellation_reason) VALUES (?, ?, ?, ?, ?)')
    .run(filmId, hallId, new Date(startTime).toISOString(), status, cancellationReason).lastInsertRowid);
}

function insertUser(db, { email = `user${Date.now()}${Math.random()}@example.com`, role = 'USER' } = {}) {
  return Number(db.prepare('INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)')
    .run(email, 'fixture-hash', role, new Date().toISOString()).lastInsertRowid);
}

function insertBooking(db, { userId, sessionId, seats, status = 'ACTIVE' }) {
  const bookingId = Number(db.prepare('INSERT INTO bookings (user_id, session_id, status, created_at, cancelled_at) VALUES (?, ?, ?, ?, ?)')
    .run(userId, sessionId, status, new Date().toISOString(), status === 'CANCELLED' ? new Date().toISOString() : null).lastInsertRowid);
  const seat = db.prepare('INSERT INTO booking_seats (booking_id, session_id, seat_row, seat_number, active) VALUES (?, ?, ?, ?, ?)');
  for (const s of seats) seat.run(bookingId, sessionId, s.row, s.number, status === 'ACTIVE' ? 1 : 0);
  return bookingId;
}

// Зручний набір: фільм, зал 2x3 і сеанс через годину після TEST_NOW.
function seedBasicSession(db, now) {
  const filmId = insertFilm(db);
  const hallId = insertHall(db);
  const startTime = new Date(new Date(now).getTime() + 60 * 60 * 1000).toISOString();
  const sessionId = insertSession(db, { filmId, hallId, startTime });
  return { filmId, hallId, sessionId, startTime };
}

module.exports = { insertFilm, insertHall, insertSession, insertUser, insertBooking, seedBasicSession };
