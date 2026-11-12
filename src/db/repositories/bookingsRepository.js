// Робота з таблицями bookings і booking_seats.
const { immediateTransaction } = require('./sql');

// Місця вже зайняті, бронювання не створено (REQ-F-009, REQ-F-010).
class SeatsTakenError extends Error {
  constructor(seats) {
    super('Seats already taken');
    this.name = 'SeatsTakenError';
    this.seats = seats;
  }
}

const BOOKING_SELECT = `
  SELECT b.id, b.user_id, b.status, b.created_at, b.cancelled_at, b.cancellation_reason,
         s.id AS session_id, s.start_time, s.status AS session_status,
         f.title AS film_title, h.name AS hall_name
    FROM bookings b
    JOIN sessions s ON s.id = b.session_id
    JOIN films f ON f.id = s.film_id
    JOIN halls h ON h.id = s.hall_id`;

function createBookingsRepository(db) {
  function seatsOf(bookingId) {
    return db.prepare('SELECT seat_row AS row, seat_number AS number FROM booking_seats WHERE booking_id = ? ORDER BY seat_row, seat_number')
      .all(bookingId);
  }

  function toBooking(row) {
    return {
      id: row.id,
      userId: row.user_id,
      status: row.status,
      seats: seatsOf(row.id),
      session: {
        id: row.session_id,
        startTime: row.start_time,
        status: row.session_status,
        filmTitle: row.film_title,
        hallName: row.hall_name,
      },
      createdAt: row.created_at,
      cancelledAt: row.cancelled_at,
      cancellationReason: row.cancellation_reason,
    };
  }

  function findTaken(sessionId, seats) {
    const stmt = db.prepare('SELECT 1 FROM booking_seats WHERE session_id = ? AND seat_row = ? AND seat_number = ? AND active = 1');
    return seats.filter((s) => stmt.get(sessionId, s.row, s.number));
  }

  // Перевірка всіх місць і запис бронювання в одній транзакції (REQ-F-008, REQ-NF-001).
  // IMMEDIATE одразу бере блокування на запис, тому між перевіркою і записом
  // інше з'єднання не може зайняти ці місця. Унікальний індекс ux_active_seat є
  // останнім захистом від подвійного бронювання (REQ-NF-006).
  const insertAtomic = immediateTransaction(db, ({ userId, sessionId, seats, createdAt }) => {
    const taken = findTaken(sessionId, seats);
    if (taken.length) throw new SeatsTakenError(taken);
    const bookingId = Number(db.prepare('INSERT INTO bookings (user_id, session_id, status, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, sessionId, 'ACTIVE', createdAt).lastInsertRowid);
    const insertSeat = db.prepare('INSERT INTO booking_seats (booking_id, session_id, seat_row, seat_number, active) VALUES (?, ?, ?, ?, 1)');
    for (const s of seats) insertSeat.run(bookingId, sessionId, s.row, s.number);
    return bookingId;
  });

  const cancelTx = immediateTransaction(db, ({ bookingId, cancelledAt }) => {
    const changed = db.prepare("UPDATE bookings SET status = 'CANCELLED', cancelled_at = ? WHERE id = ? AND status = 'ACTIVE'")
      .run(cancelledAt, bookingId).changes;
    if (changed) db.prepare('UPDATE booking_seats SET active = 0 WHERE booking_id = ?').run(bookingId);
    return changed > 0;
  });

  return {
    // Місця активних бронювань сеансу (REQ-F-002, REQ-F-013).
    listTakenSeats(sessionId) {
      return db.prepare('SELECT seat_row AS row, seat_number AS number FROM booking_seats WHERE session_id = ? AND active = 1')
        .all(sessionId);
    },

    createBookingAtomic(params) {
      try {
        return insertAtomic(params);
      } catch (err) {
        if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new SeatsTakenError(findTaken(params.sessionId, params.seats));
        }
        throw err;
      }
    },

    findBookingById(id) {
      const row = db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(id);
      return row ? toBooking(row) : null;
    },

    listBookingsByUser(userId) {
      return db.prepare(`${BOOKING_SELECT} WHERE b.user_id = ? ORDER BY b.created_at DESC, b.id DESC`).all(userId).map(toBooking);
    },

    // Повне скасування: статус бронювання і звільнення всіх його місць в одній транзакції
    // (REQ-F-011, REQ-F-013). Умова status = 'ACTIVE' не дає скасувати двічі (REQ-F-014).
    cancelBooking: cancelTx,
  };
}

module.exports = { createBookingsRepository, SeatsTakenError };
