// Публічна афіша і схема залу (REQ-F-001, REQ-F-002, REQ-F-013, ADD-12).
// Фільтри афіші за датою і фільмом (REQ-F-021..REQ-F-023, ADD-14..ADD-19, spec/addendum-session-filters.md).
const { ApiError } = require('../errors');
const { isoNow } = require('../clock');
const { toFilm } = require('../db/repositories/filmsRepository');
const { EVENT_TYPES, STATUSES } = require('../logging/events');
const { isPositiveInt, isCalendarDate } = require('./validation');

const DAY_MS = 24 * 60 * 60 * 1000;
const FILTERS = ['date', 'filmId'];

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

// Перевірка одного параметра запиту. Повтор параметра дає масив і відхиляється (ADD-17).
function filterError(name, value) {
  if (Array.isArray(value)) return `${name}: параметр передано кілька разів`;
  if (name === 'date' && !isCalendarDate(value)) return 'date: очікується дата у форматі YYYY-MM-DD';
  if (name === 'filmId' && !/^[1-9]\d*$/.test(value)) return 'filmId: очікується ціле число від 1';
  return null;
}

// Перетворює параметри запиту на умови вибірки. Доба D за UTC це [D 00:00, D+1 00:00) (ADD-15).
function toCriteria(query) {
  const criteria = {};
  if (query.date !== undefined) {
    const from = new Date(`${query.date}T00:00:00.000Z`);
    criteria.from = from.toISOString();
    criteria.to = new Date(from.getTime() + DAY_MS).toISOString();
  }
  if (query.filmId !== undefined) criteria.filmId = Number(query.filmId);
  return criteria;
}

function createCatalogService({ sessionsRepository, hallsRepository, bookingsRepository, logger, clock }) {
  // Некоректний фільтр відхиляє весь запит з 400 і пишеться в лог як SESSIONS_LISTED REJECTED (ADD-17, ADD-18).
  function validateFilters(query) {
    const given = FILTERS.filter((name) => query[name] !== undefined);
    const details = given.map((name) => filterError(name, query[name])).filter(Boolean);
    if (!details.length) return;
    logger.log({
      event_type: EVENT_TYPES.SESSIONS_LISTED,
      status: STATUSES.REJECTED,
      user_id: null,
      entity_ids: Object.fromEntries(given.map((name) => [name, query[name]])),
      reason: `Помилка валідації: ${details.join(', ')}`,
    });
    throw new ApiError(400, 'VALIDATION_ERROR', 'Некоректні параметри фільтра афіші', details);
  }

  // Без фільтрів поведінка як у версії 1.0.0, успішний перегляд не логується (REQ-F-023, ADD-18).
  function listSessions(query = {}) {
    validateFilters(query);
    const rows = sessionsRepository.listUpcomingActiveSessions(isoNow(clock), toCriteria(query));
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
