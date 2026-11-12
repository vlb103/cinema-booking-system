// Бронювання (REQ-F-007..REQ-F-010, REQ-F-020, REQ-F-005, REQ-NF-001, ADD-02, ADD-06, ADD-09).
// Скасування бронювання клієнтом (REQ-F-011..REQ-F-014).
const { ApiError } = require('../errors');
const { isoNow } = require('../clock');
const { EVENT_TYPES, STATUSES } = require('../logging/events');
const { SeatsTakenError } = require('../db/repositories/bookingsRepository');
const { isPositiveInt } = require('./validation');
const { hasStarted, isBookable } = require('./sessionRules');

const MIN_SEATS = 1;
const MAX_SEATS = 6;

const seatLabel = (s) => `ряд ${s.row}, місце ${s.number}`;
const isSeat = (s) => Boolean(s) && typeof s === 'object' && isPositiveInt(s.row) && isPositiveInt(s.number);

function seatErrors(seats) {
  const details = [];
  if (seats.length < MIN_SEATS || seats.length > MAX_SEATS) {
    details.push(`seats: отримано ${seats.length} місць, дозволено від ${MIN_SEATS} до ${MAX_SEATS}`);
  }
  const seen = new Set();
  seats.forEach((s, i) => {
    if (!isSeat(s)) {
      details.push(`seats[${i}]: потрібні цілі row і number від 1`);
      return;
    }
    const key = `${s.row}-${s.number}`;
    if (seen.has(key)) details.push(`seats[${i}]: ${seatLabel(s)} повторюється`);
    seen.add(key);
  });
  return details;
}

// Перевірка запиту за схемою CreateBookingRequest (ADD-09).
function requestErrors(body) {
  const details = [];
  if (!isPositiveInt(body.sessionId)) details.push('sessionId: має бути додатним цілим числом');
  if (!Array.isArray(body.seats)) return [...details, 'seats: має бути масивом місць'];
  return [...details, ...seatErrors(body.seats)];
}

function createBookingService({ bookingsRepository, sessionsRepository, hallsRepository, logger, clock }) {
  function log(eventType, status, user, entityIds, reason = null) {
    logger.log({ event_type: eventType, status, user_id: user.id, entity_ids: entityIds, reason });
  }

  // Записує відмову в створенні бронювання і повертає помилку для відповіді.
  function rejectCreate(user, body, reason, error) {
    const entityIds = {};
    if (body.sessionId !== undefined) entityIds.sessionId = body.sessionId;
    if (Array.isArray(body.seats)) entityIds.seats = body.seats;
    log(EVENT_TYPES.BOOKING_CREATED, STATUSES.REJECTED, user, entityIds, reason);
    return error;
  }

  // Сеанс має існувати, бути активним і ще не початим (ADD-06).
  function findBookableSession(user, body) {
    const session = sessionsRepository.findSessionById(body.sessionId);
    if (!session) {
      throw rejectCreate(user, body, 'Сеанс не знайдено', new ApiError(404, 'NOT_FOUND', 'Сеанс не знайдено'));
    }
    if (!isBookable(session, clock.now())) {
      const reason = session.status !== 'ACTIVE' ? 'Сеанс скасовано' : 'Сеанс уже розпочався';
      throw rejectCreate(user, body, reason, new ApiError(409, 'SESSION_NOT_AVAILABLE', 'Сеанс скасовано або він уже розпочався'));
    }
    return session;
  }

  // Кожне місце має існувати в схемі залу сеансу (ADD-09).
  function assertSeatsInHall(user, body, session) {
    const hall = hallsRepository.findHallById(session.hallId);
    const outside = body.seats.filter((s) => s.row > hall.rowsCount || s.number > hall.seatsPerRow);
    if (!outside.length) return;
    const details = outside.map((s) => `${seatLabel(s)} поза схемою залу`);
    throw rejectCreate(user, body, `Помилка валідації: ${details.join(', ')}`,
      new ApiError(400, 'VALIDATION_ERROR', 'Місце поза схемою залу', details));
  }

  // Атомарний запис, зайняті місця перетворюються на 409 SEATS_TAKEN (REQ-F-009, REQ-F-010).
  function insertBooking(user, body, session, seats) {
    try {
      return bookingsRepository.createBookingAtomic({ userId: user.id, sessionId: session.id, seats, createdAt: isoNow(clock) });
    } catch (err) {
      if (!(err instanceof SeatsTakenError)) throw err;
      const details = err.seats.map(seatLabel);
      throw rejectCreate(user, body, `Місця зайняті: ${details.join('; ')}`,
        new ApiError(409, 'SEATS_TAKEN', 'Одне або кілька місць уже зайняті, бронювання не створено', details));
    }
  }

  function createBooking(user, body = {}) {
    const details = requestErrors(body);
    if (details.length) {
      throw rejectCreate(user, body, `Помилка валідації: ${details.join(', ')}`,
        new ApiError(400, 'VALIDATION_ERROR', 'Бронювання має містити від 1 до 6 різних місць', details));
    }
    const session = findBookableSession(user, body);
    assertSeatsInHall(user, body, session);

    const seats = body.seats.map((s) => ({ row: s.row, number: s.number }));
    const bookingId = insertBooking(user, body, session, seats);
    log(EVENT_TYPES.BOOKING_CREATED, STATUSES.SUCCESS, user, { sessionId: session.id, bookingId, seats });
    return bookingsRepository.findBookingById(bookingId);
  }

  // Лише бронювання поточного користувача (REQ-F-005, REQ-NF-004).
  function listMyBookings(user) {
    return bookingsRepository.listBookingsByUser(user.id);
  }

  // Бронювання має існувати і належати користувачу. Чуже дає 403 без розкриття даних (ADD-04, REQ-NF-004).
  function findOwnBooking(user, bookingId) {
    const booking = isPositiveInt(bookingId) ? bookingsRepository.findBookingById(bookingId) : null;
    if (!booking) {
      log(EVENT_TYPES.BOOKING_CANCELLED, STATUSES.REJECTED, user, { bookingId }, 'Бронювання не знайдено');
      throw new ApiError(404, 'NOT_FOUND', 'Бронювання не знайдено');
    }
    if (booking.userId !== user.id) {
      log(EVENT_TYPES.BOOKING_CANCELLED, STATUSES.REJECTED, user, { bookingId }, 'Спроба скасувати чуже бронювання');
      throw new ApiError(403, 'FORBIDDEN', 'Доступ заборонено');
    }
    return booking;
  }

  function cancelBooking(user, bookingId) {
    const booking = findOwnBooking(user, bookingId);
    // Повторне скасування повертає поточний стан без змін (REQ-F-014).
    if (booking.status === 'CANCELLED') return booking;

    const entityIds = { bookingId: booking.id, sessionId: booking.session.id, seats: booking.seats };
    // Скасування дозволене лише до початку сеансу (REQ-F-012).
    if (hasStarted(booking.session, clock.now())) {
      log(EVENT_TYPES.BOOKING_CANCELLED, STATUSES.REJECTED, user, entityIds, 'Сеанс уже розпочався, скасування неможливе');
      throw new ApiError(409, 'CANCELLATION_DEADLINE_PASSED', 'Сеанс уже розпочався, скасування неможливе');
    }
    if (bookingsRepository.cancelBooking({ bookingId: booking.id, cancelledAt: isoNow(clock) })) {
      log(EVENT_TYPES.BOOKING_CANCELLED, STATUSES.SUCCESS, user, entityIds);
    }
    return bookingsRepository.findBookingById(booking.id);
  }

  return { createBooking, listMyBookings, cancelBooking };
}

module.exports = { createBookingService };
