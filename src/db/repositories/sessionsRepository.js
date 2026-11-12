// Робота з таблицею sessions.
const { NotImplementedError } = require('../../errors');

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

function createSessionsRepository(db) {
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

    findSessionById(id) {
      const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
      return row ? toSession(row) : null;
    },

    // Наступні раунди
    createSession() { throw new NotImplementedError('sessionsRepository.createSession'); },
    updateSession() { throw new NotImplementedError('sessionsRepository.updateSession'); },
    cancelSession() { throw new NotImplementedError('sessionsRepository.cancelSession'); },
  };
}

module.exports = { createSessionsRepository, toSession };
