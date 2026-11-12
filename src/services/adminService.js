// Керування фільмами, залами, сеансами (REQ-F-015..REQ-F-019, ADD-07, ADD-08, ADD-11, ADD-13).
const { ApiError } = require('../errors');
const { EVENT_TYPES, STATUSES } = require('../logging/events');

const isPositiveInt = (v) => Number.isInteger(v) && v >= 1;
const isText = (v, min, max) => typeof v === 'string' && v.length >= min && v.length <= max;
// date-time за RFC 3339 з обов'язковим часовим поясом
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const isDateTime = (v) => typeof v === 'string' && DATE_TIME.test(v) && !Number.isNaN(Date.parse(v));

const FILM_FIELDS = ['title', 'durationMinutes', 'description'];
const SESSION_FIELDS = ['filmId', 'hallId', 'startTime'];
const REASON_MAX = 500;

function pick(body, keys) {
  return Object.fromEntries(keys.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
}

// Перевіряє лише передані поля фільму (для створення обов'язковість перевіряється окремо).
function filmFieldErrors(fields) {
  const details = [];
  if ('title' in fields && !isText(fields.title, 1, 200)) details.push('title: рядок від 1 до 200 символів');
  if ('durationMinutes' in fields && !isPositiveInt(fields.durationMinutes)) details.push('durationMinutes: ціле число від 1');
  if ('description' in fields && !isText(fields.description, 0, 2000)) details.push('description: рядок до 2000 символів');
  return details;
}

function sessionFieldErrors(fields) {
  const details = [];
  if ('filmId' in fields && !isPositiveInt(fields.filmId)) details.push('filmId: додатне ціле число');
  if ('hallId' in fields && !isPositiveInt(fields.hallId)) details.push('hallId: додатне ціле число');
  if ('startTime' in fields && !isDateTime(fields.startTime)) details.push('startTime: дата і час у форматі ISO-8601');
  return details;
}

function missing(fields, keys) {
  return keys.filter((k) => !(k in fields)).map((k) => `${k}: обов'язкове поле`);
}

function createAdminService({ filmsRepository, hallsRepository, sessionsRepository, logger, clock }) {
  function audit(user, eventType, status, entityIds, reason = null) {
    logger.log({ event_type: eventType, status, user_id: user.id, entity_ids: entityIds, reason });
  }

  function validationError(user, eventType, entityIds, details) {
    audit(user, eventType, STATUSES.REJECTED, entityIds, `Помилка валідації: ${details.join(', ')}`);
    return new ApiError(400, 'VALIDATION_ERROR', 'Некоректні дані запиту', details);
  }

  function notFound(user, eventType, entityIds, what) {
    audit(user, eventType, STATUSES.REJECTED, entityIds, `${what} не знайдено`);
    return new ApiError(404, 'NOT_FOUND', `${what} не знайдено`);
  }

  // Фільми

  function createFilm(user, body = {}) {
    const fields = pick(body, FILM_FIELDS);
    const details = [...missing(fields, ['title', 'durationMinutes']), ...filmFieldErrors(fields)];
    if (details.length) throw validationError(user, EVENT_TYPES.FILM_CREATED, {}, details);
    const film = filmsRepository.createFilm(fields);
    audit(user, EVENT_TYPES.FILM_CREATED, STATUSES.SUCCESS, { filmId: film.id });
    return film;
  }

  function updateFilm(user, filmId, body = {}) {
    const fields = pick(body, FILM_FIELDS);
    const details = Object.keys(fields).length ? filmFieldErrors(fields) : ['тіло запиту: потрібне хоча б одне поле'];
    if (details.length) throw validationError(user, EVENT_TYPES.FILM_UPDATED, { filmId }, details);
    if (!isPositiveInt(filmId) || !filmsRepository.findFilmById(filmId)) {
      throw notFound(user, EVENT_TYPES.FILM_UPDATED, { filmId }, 'Фільм');
    }
    const film = filmsRepository.updateFilm(filmId, fields);
    audit(user, EVENT_TYPES.FILM_UPDATED, STATUSES.SUCCESS, { filmId, fields: Object.keys(fields) });
    return film;
  }

  // Зали. Місткість з запиту ігнорується, її рахує сервер (ADD-07).

  function createHall(user, body = {}) {
    const fields = pick(body, ['name', 'rowsCount', 'seatsPerRow']);
    const details = missing(fields, ['name', 'rowsCount', 'seatsPerRow']);
    if ('name' in fields && !isText(fields.name, 1, 100)) details.push('name: рядок від 1 до 100 символів');
    if ('rowsCount' in fields && !isPositiveInt(fields.rowsCount)) details.push('rowsCount: ціле число від 1');
    if ('seatsPerRow' in fields && !isPositiveInt(fields.seatsPerRow)) details.push('seatsPerRow: ціле число від 1');
    if (details.length) throw validationError(user, EVENT_TYPES.HALL_CREATED, {}, details);
    const hall = hallsRepository.createHall(fields);
    audit(user, EVENT_TYPES.HALL_CREATED, STATUSES.SUCCESS, { hallId: hall.id });
    return hall;
  }

  // Сеанси

  function checkRefs(user, eventType, entityIds, fields) {
    if ('filmId' in fields && !filmsRepository.findFilmById(fields.filmId)) throw notFound(user, eventType, entityIds, 'Фільм');
    if ('hallId' in fields && !hallsRepository.findHallById(fields.hallId)) throw notFound(user, eventType, entityIds, 'Зал');
  }

  // Час зберігається в UTC (ADD-07).
  function normalize(fields) {
    return 'startTime' in fields ? { ...fields, startTime: new Date(fields.startTime).toISOString() } : fields;
  }

  function createSession(user, body = {}) {
    const fields = pick(body, SESSION_FIELDS);
    const details = [...missing(fields, SESSION_FIELDS), ...sessionFieldErrors(fields)];
    if (details.length) throw validationError(user, EVENT_TYPES.SESSION_CREATED, {}, details);
    checkRefs(user, EVENT_TYPES.SESSION_CREATED, { filmId: fields.filmId, hallId: fields.hallId }, fields);
    // Перетин сеансів в одному залі у версії 1 не перевіряється (ADD-08).
    const session = sessionsRepository.createSession(normalize(fields));
    audit(user, EVENT_TYPES.SESSION_CREATED, STATUSES.SUCCESS, { sessionId: session.id, filmId: session.filmId, hallId: session.hallId });
    return session;
  }

  function updateSession(user, sessionId, body = {}) {
    const fields = pick(body, SESSION_FIELDS);
    const ids = { sessionId };
    const details = Object.keys(fields).length ? sessionFieldErrors(fields) : ['тіло запиту: потрібне хоча б одне поле'];
    if (details.length) throw validationError(user, EVENT_TYPES.SESSION_UPDATED, ids, details);
    const session = isPositiveInt(sessionId) ? sessionsRepository.findSessionById(sessionId) : null;
    if (!session) throw notFound(user, EVENT_TYPES.SESSION_UPDATED, ids, 'Сеанс');
    if (session.status === 'CANCELLED') {
      audit(user, EVENT_TYPES.SESSION_UPDATED, STATUSES.REJECTED, ids, 'Сеанс скасовано, редагування неможливе');
      throw new ApiError(409, 'SESSION_ALREADY_CANCELLED', 'Сеанс скасовано, редагування неможливе');
    }
    checkRefs(user, EVENT_TYPES.SESSION_UPDATED, ids, fields);
    // Зміна дозволена лише без активних бронювань (REQ-F-016, REQ-F-017).
    const result = sessionsRepository.updateSessionIfNoActiveBookings(sessionId, normalize(fields));
    if (result.blocked) {
      audit(user, EVENT_TYPES.SESSION_UPDATED, STATUSES.REJECTED, ids, 'На сеанс є активні бронювання, зміна заблокована');
      throw new ApiError(409, 'SESSION_HAS_ACTIVE_BOOKINGS', 'На сеанс є активні бронювання, зміна заблокована');
    }
    audit(user, EVENT_TYPES.SESSION_UPDATED, STATUSES.SUCCESS, { sessionId, fields: Object.keys(fields) });
    return result.session;
  }

  // Явне скасування сеансу з обов'язковою причиною і каскадом на бронювання (REQ-F-018, REQ-F-019, ADD-11).
  function cancelSession(user, sessionId, body = {}) {
    const ids = { sessionId };
    const { reason } = body;
    if (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > REASON_MAX) {
      throw validationError(user, EVENT_TYPES.SESSION_CANCELLED, ids, [`reason: непорожній рядок до ${REASON_MAX} символів`]);
    }
    const session = isPositiveInt(sessionId) ? sessionsRepository.findSessionById(sessionId) : null;
    if (!session) throw notFound(user, EVENT_TYPES.SESSION_CANCELLED, ids, 'Сеанс');
    if (session.status === 'CANCELLED') {
      audit(user, EVENT_TYPES.SESSION_CANCELLED, STATUSES.REJECTED, ids, 'Сеанс уже скасовано');
      throw new ApiError(409, 'SESSION_ALREADY_CANCELLED', 'Сеанс уже скасовано');
    }
    const result = sessionsRepository.cancelSessionCascade({ sessionId, reason, cancelledAt: clock.now().toISOString() });
    audit(user, EVENT_TYPES.SESSION_CANCELLED, STATUSES.SUCCESS, { sessionId, bookingIds: result.bookingIds }, reason);
    return { session: result.session, cancelledBookingsCount: result.bookingIds.length };
  }

  return {
    listFilms: () => filmsRepository.listFilms(),
    listHalls: () => hallsRepository.listHalls(),
    createFilm,
    updateFilm,
    createHall,
    createSession,
    updateSession,
    cancelSession,
  };
}

module.exports = { createAdminService };
