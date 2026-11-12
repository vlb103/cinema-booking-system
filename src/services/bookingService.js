// Бронювання і скасування бронювань (REQ-F-007..REQ-F-014). Наступний раунд.
const { NotImplementedError } = require('../errors');

function createBookingService() {
  return {
    createBooking() { throw new NotImplementedError('bookingService.createBooking'); },
    listMyBookings() { throw new NotImplementedError('bookingService.listMyBookings'); },
    cancelBooking() { throw new NotImplementedError('bookingService.cancelBooking'); },
  };
}

module.exports = { createBookingService };
