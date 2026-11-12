// Робота з таблицею sessions.

function toSession(row) {
  return {
    id: row.id,
    filmId: row.film_id,
    hallId: row.hall_id,
    startTime: row.start_time,
    status: row.status,
    cancellationReason: row.cancellation_reason,
  };
}

const COLUMNS = { filmId: 'film_id', hallId: 'hall_id', startTime: 'start_time' };

function createSessionsRepository(db) {
  function findSessionById(id) {
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    return row ? toSession(row) : null;
  }

  // Транзакція з блокуванням на запис від самого початку (BEGIN IMMEDIATE).
  const immediate = (fn) => { const tx = db.transaction(fn); return (...args) => tx.immediate(...args); };

  const countActiveBookings = (sessionId) => db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE session_id = ? AND status = 'ACTIVE'")
    .get(sessionId).n;

  return {
    // Активні сеанси, які ще не почалися (ADD-12). Час зберігається в ISO-8601 UTC,
    // тому рядкове порівняння відповідає порівнянню часу.
    listUpcomingActiveSessions(nowIso) {
      return db.prepare(`
        SELECT s.id, s.start_time, s.status,
               f.id AS film_id, f.title, f.duration_minutes, f.description,
               h.id AS hall_id, h.name AS hall_name
          FROM sessions s
          JOIN films f ON f.id = s.film_id
          JOIN halls h ON h.id = s.hall_id
         WHERE s.status = 'ACTIVE' AND s.start_time > ?
         ORDER BY s.start_time, s.id
      `).all(nowIso);
    },

    findSessionById,

    createSession({ filmId, hallId, startTime }) {
      const id = Number(db.prepare("INSERT INTO sessions (film_id, hall_id, start_time, status) VALUES (?, ?, ?, 'ACTIVE')")
        .run(filmId, hallId, startTime).lastInsertRowid);
      return findSessionById(id);
    },

    // Перевірка активних бронювань і зміна сеансу в одній транзакції (REQ-F-016, REQ-F-017),
    // щоб між перевіркою і зміною не з'явилося нове бронювання.
    updateSessionIfNoActiveBookings: immediate((id, fields) => {
      if (countActiveBookings(id) > 0) return { blocked: true };
      const keys = Object.keys(fields).filter((k) => COLUMNS[k]);
      const sets = keys.map((k) => `${COLUMNS[k]} = ?`).join(', ');
      db.prepare(`UPDATE sessions SET ${sets} WHERE id = ?`).run(...keys.map((k) => fields[k]), id);
      return { blocked: false, session: findSessionById(id) };
    }),

    // Скасування сеансу і каскадне скасування всіх його активних бронювань в одній транзакції
    // (REQ-F-018, REQ-F-019). Бронювання лишаються в історії зі статусом CANCELLED і причиною.
    cancelSessionCascade: immediate(({ sessionId, reason, cancelledAt }) => {
      const bookingIds = db.prepare("SELECT id FROM bookings WHERE session_id = ? AND status = 'ACTIVE' ORDER BY id")
        .all(sessionId).map((r) => r.id);
      db.prepare(`UPDATE bookings SET status = 'CANCELLED', cancelled_at = ?, cancellation_reason = ?
                   WHERE session_id = ? AND status = 'ACTIVE'`).run(cancelledAt, reason, sessionId);
      db.prepare('UPDATE booking_seats SET active = 0 WHERE session_id = ? AND active = 1').run(sessionId);
      db.prepare("UPDATE sessions SET status = 'CANCELLED', cancellation_reason = ? WHERE id = ?").run(reason, sessionId);
      return { session: findSessionById(sessionId), bookingIds };
    }),
  };
}

module.exports = { createSessionsRepository, toSession };
