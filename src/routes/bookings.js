// Маршрути Bookings за docs/api/openapi.yaml. Доступні лише ролі USER (ADD-10).
const express = require('express');
const { parseId, respond, bodyOf } = require('./helpers');

function createBookingsRouter({ auth, bookingService }) {
  const router = express.Router();
  router.use(auth.requireAuth, auth.requireRole('USER'));

  router.post('/', respond(201, (req) => bookingService.createBooking(req.user, bodyOf(req))));
  router.get('/', respond(200, (req) => bookingService.listMyBookings(req.user)));
  // Тіло запиту ігнорується, скасування лише повне (REQ-F-011).
  router.post('/:bookingId/cancel', respond(200, (req) => bookingService.cancelBooking(req.user, parseId(req.params.bookingId))));

  return router;
}

module.exports = { createBookingsRouter };
