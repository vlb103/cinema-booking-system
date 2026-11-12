// Маршрути Bookings за docs/api/openapi.yaml. Доступні лише ролі USER (ADD-10).
// Скасування (cancelBooking) додається в раунді скасування.
const express = require('express');

function createBookingsRouter({ auth, bookingService }) {
  const router = express.Router();
  router.use(auth.requireAuth, auth.requireRole('USER'));

  router.post('/', (req, res) => {
    res.status(201).json(bookingService.createBooking(req.user, req.body || {}));
  });

  router.get('/', (req, res) => {
    res.status(200).json(bookingService.listMyBookings(req.user));
  });

  return router;
}

module.exports = { createBookingsRouter };
