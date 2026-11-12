// Бронювання (REQ-F-007..REQ-F-010, REQ-F-020, REQ-F-005, REQ-NF-001, ADD-02, ADD-06, ADD-09).
// Скасування бронювання клієнтом (REQ-F-011..REQ-F-014).
const { ApiError } = require('../errors');
const { EVENT_TYPES, STATUSES } = require('../logging/events');
const { SeatsTakenError } = require('../db/repositories/bookingsRepository');

const MIN_SEATS = 1;
const MAX_SEATS = 6;

const isPositiveInt = (v) => Number.isInteger(v) && v >= 1;
const seatLabel = (s) => `ряд ${s.row}, місце ${s.number}`;

// Перевірка запиту за схемою CreateBookingRequest (ADD-09).
function requestErrors(body) {
  const details = [];
  if (!isPositiveInt(body.sessionId)) details.push('sessionId: має бути додатним цілим числом');
  if (!Array.isArray(body.seats)) {
    details.push('seats: має бути масивом місць');
    return details;
  }
  if (body.seats.length < MIN_SEATS || body.seats.length > MAX_SEATS) {
    details.push(`seats: отримано ${body.seats.length} місць, дозволено від ${MIN_SEATS} до ${MAX_SEATS}`);
  }
  const seen = new Set();
  body.seats.forEach((s, i) => {
    if (!s || typeof s !== 'object' || !isPositiveInt(s.row) || !isPositiveInt(s.number)) {
      details.push(`seats[${i}]: потрібні цілі row і number від 1`);
      return;
    }
    const key = `${s.row}-${s.number}`;
    if (seen.has(key)) details.push(`seats[${i}]: ${seatLabel(s)} повторюється`);
    seen.add(key);
  });
  return details;
}

function createBookingService({ bookingsRepository, sessionsRepository, hallsRepository, logger, clock }) {
  function reject(user, body, reason) {
    const entityIds = {};
    if (body.sessionId !== undefined) entityIds.sessionId = body.sessionId;
    if (Array.isArray(body.seats)) entityIds.seats = body.seats;
    logger.log({ event_type: EVENT_TYPES.BOOKING_CREATED, status: STATUSES.REJECTED, user_id: user.id, entity_ids: entityIds, reason });
  }

  function createBooking(user, body = {}) {
    const details = requestErrors(body);
    if (details.length) {
      reject(user, body, `Помилка валідації: ${details.join(', ')}`);
      throw new ApiError(400, 'VALIDATION_ERROR', 'Бронювання має містити від 1 до 6 різних місць', details);
    }

    const session = sessionsRepository.findSessionById(body.sessionId);
    if (!session) {
      reject(user, body, 'Сеанс не знайдено');
      throw new ApiError(404, 'NOT_FOUND', 'Сеанс не знайдено');
    }
    // Скасований або вже розпочатий сеанс недоступний (ADD-06).
    if (session.status !== 'ACTIVE' || new Date(session.startTime) <= clock.now()) {
      reject(user, body, session.status !== 'ACTIVE' ? 'Сеанс скасовано' : 'Сеанс уже розпочався');
      throw new ApiError(409, 'SESSION_NOT_AVAILABLE', 'Сеанс скасовано або він уже розпочався');
    }

    // Кожне місце має існувати в схемі залу (ADD-09).
    const hall = hallsRepository.findHallById(session.hallId);
    const outside = body.seats.filter((s) => s.row > hall.rowsCount || s.number > hall.seatsPerRow);
    if (outside.length) {
      const outDetails = outside.map((s) => `${seatLabel(s)} поза схемою залу`);
      reject(user, body, `Помилка валідації: ${outDetails.join(', ')}`);
      throw new ApiError(400, 'VALIDATION_ERROR', 'Місце поза схемою залу', outDetails);
    }

    const seats = body.seats.map((s) => ({ row: s.row, number: s.number }));
    let bookingId;
    try {
      bookingId = bookingsRepository.createBookingAtomic({
        userId: user.id, sessionId: session.id, seats, createdAt: clock.now().toISOString(),
      });
    } catch (err) {
      if (err instanceof SeatsTakenError) {
        const takenDetails = err.seats.map(seatLabel);
        reject(user, body, `Місця зайняті: ${takenDetails.join('; ')}`);
        throw new ApiError(409, 'SEATS_TAKEN', 'Одне або кілька місць уже зайняті, бронювання не створено', takenDetails);
      }
      throw err;
    }

    logger.log({
      event_type: EVENT_TYPES.BOOKING_CREATED,
      status: STATUSES.SUCCESS,
      user_id: user.id,
      entity_ids: { sessionId: session.id, bookingId, seats },
    });
    return bookingsRepository.findBookingById(bookingId);
  }

  // Лише бронювання поточного користувача (REQ-F-005, REQ-NF-004).
  function listMyBookings(user) {
    return bookingsRepository.listBookingsByUser(user.id);
  }

  // Скасування бронювання клієнтом (REQ-F-011..REQ-F-014, REQ-F-005, ADD-04).
  function cancelBooking(user, bookingId) {
    const logCancel = (status, entityIds, reason = null) => logger.log({
      event_type: EVENT_TYPES.BOOKING_CANCELLED, status, user_id: user.id, entity_ids: entityIds, reason,
    });

    const booking = Number.isInteger(bookingId) && bookingId > 0 ? bookingsRepository.findBookingById(bookingId) : null;
    if (!booking) {
      logCancel(STATUSES.REJECTED, { bookingId }, 'Бронювання не знайдено');
      throw new ApiError(404, 'NOT_FOUND', 'Бронювання не знайдено');
    }
    // Чуже бронювання дає 403 без розкриття його даних (REQ-NF-004).
    if (booking.userId !== user.id) {
      logCancel(STATUSES.REJECTED, { bookingId }, 'Спроба скасувати чуже бронювання');
      throw new ApiError(403, 'FORBIDDEN', 'Доступ заборонено');
    }
    // Повторне скасування повертає поточний стан без змін (REQ-F-014).
    if (booking.status === 'CANCELLED') return booking;

    const entityIds = { bookingId: booking.id, sessionId: booking.session.id, seats: booking.seats };
    // Скасування дозволене лише поки T поточний < T сеансу (REQ-F-012).
    if (clock.now() >= new Date(booking.session.startTime)) {
      logCancel(STATUSES.REJECTED, entityIds, 'Сеанс уже розпочався, скасування неможливе');
      throw new ApiError(409, 'CANCELLATION_DEADLINE_PASSED', 'Сеанс уже розпочався, скасування неможливе');
    }

    if (bookingsRepository.cancelBooking({ bookingId: booking.id, cancelledAt: clock.now().toISOString() })) {
      logCancel(STATUSES.SUCCESS, entityIds);
    }
    return bookingsRepository.findBookingById(booking.id);
  }

  return { createBooking, listMyBookings, cancelBooking };
}

module.exports = { createBookingService };
