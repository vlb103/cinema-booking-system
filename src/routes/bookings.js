// Маршрути Bookings за docs/api/openapi.yaml. Доступні лише ролі USER (ADD-10).
const express = require('express');
const { parseId } = require('./params');

function createBookingsRouter({ auth, bookingService }) {
  const router = express.Router();
  router.use(auth.requireAuth, auth.requireRole('USER'));

  router.post('/', (req, res) => {
    res.status(201).json(bookingService.createBooking(req.user, req.body || {}));
  });

  router.get('/', (req, res) => {
    res.status(200).json(bookingService.listMyBookings(req.user));
  });

  // Тіло запиту ігнорується, скасування лише повне (REQ-F-011).
  router.post('/:bookingId/cancel', (req, res) => {
    res.status(200).json(bookingService.cancelBooking(req.user, parseId(req.params.bookingId)));
  });

  return router;
}

module.exports = { createBookingsRouter };
