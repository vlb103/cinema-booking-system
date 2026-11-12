// Публічна афіша і схема залу (REQ-F-001, REQ-F-002, REQ-F-013, ADD-12).
const { ApiError } = require('../errors');
const { isoNow } = require('../clock');
const { toFilm } = require('../db/repositories/filmsRepository');
const { isPositiveInt } = require('./validation');

const seatKey = (s) => `${s.row}-${s.number}`;

// Усі місця прямокутного залу зі станом FREE або TAKEN (REQ-F-002, ADD-07).
function buildSeatGrid(hall, takenSeats) {
  const taken = new Set(takenSeats.map(seatKey));
  const seats = [];
  for (let row = 1; row <= hall.rowsCount; row += 1) {
    for (let number = 1; number <= hall.seatsPerRow; number += 1) {
      seats.push({ row, number, status: taken.has(seatKey({ row, number })) ? 'TAKEN' : 'FREE' });
    }
  }
  return seats;
}

function createCatalogService({ sessionsRepository, hallsRepository, bookingsRepository, clock }) {
  function listSessions() {
    const rows = sessionsRepository.listUpcomingActiveSessions(isoNow(clock));
    return rows.map((r) => ({
      id: r.id,
      startTime: r.start_time,
      status: r.status,
      film: toFilm({ id: r.film_id, title: r.title, duration_minutes: r.duration_minutes, description: r.description }),
      hall: { id: r.hall_id, name: r.hall_name },
    }));
  }

  function getSeatMap(sessionId) {
    const session = isPositiveInt(sessionId) ? sessionsRepository.findSessionById(sessionId) : null;
    if (!session) throw new ApiError(404, 'NOT_FOUND', 'Сеанс не знайдено');
    const hall = hallsRepository.findHallById(session.hallId);
    const seats = buildSeatGrid(hall, bookingsRepository.listTakenSeats(session.id));
    return { sessionId: session.id, sessionStatus: session.status, hall, seats };
  }

  return { listSessions, getSeatMap };
}

module.exports = { createCatalogService };
