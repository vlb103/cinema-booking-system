// Маршрути Bookings за docs/api/openapi.yaml. Доступні лише ролі USER (ADD-10).
// Обробники createBooking, listMyBookings, cancelBooking додаються в раунді бронювань.
const express = require('express');

function createBookingsRouter({ auth }) {
  const router = express.Router();
  router.use(auth.requireAuth, auth.requireRole('USER'));
  return router;
}

module.exports = { createBookingsRouter };
