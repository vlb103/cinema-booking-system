// Маршрути Sessions за docs/api/openapi.yaml (listSessions, getSessionSeatMap). Публічні, без токена.
const express = require('express');
const { parseId, respond } = require('./helpers');

function createSessionsRouter({ catalogService }) {
  const router = express.Router();

  router.get('/', respond(200, (req) => catalogService.listSessions(req.query)));
  router.get('/:sessionId/seats', respond(200, (req) => catalogService.getSeatMap(parseId(req.params.sessionId))));

  return router;
}

module.exports = { createSessionsRouter };
