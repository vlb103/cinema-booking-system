// Робота з таблицями bookings і booking_seats.
const { NotImplementedError } = require('../../errors');

function createBookingsRepository(db) {
  return {
    // Місця активних бронювань сеансу (REQ-F-002, REQ-F-013).
    listTakenSeats(sessionId) {
      return db.prepare('SELECT seat_row AS row, seat_number AS number FROM booking_seats WHERE session_id = ? AND active = 1')
        .all(sessionId);
    },

    // Наступний раунд (бронювання)
    createBookingAtomic() { throw new NotImplementedError('bookingsRepository.createBookingAtomic'); },
    listBookingsByUser() { throw new NotImplementedError('bookingsRepository.listBookingsByUser'); },
    findBookingById() { throw new NotImplementedError('bookingsRepository.findBookingById'); },
    cancelBooking() { throw new NotImplementedError('bookingsRepository.cancelBooking'); },
    cancelBookingsBySession() { throw new NotImplementedError('bookingsRepository.cancelBookingsBySession'); },
    countActiveBySession() { throw new NotImplementedError('bookingsRepository.countActiveBySession'); },
  };
}

module.exports = { createBookingsRepository };
