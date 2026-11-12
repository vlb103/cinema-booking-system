// Маршрути Sessions за docs/api/openapi.yaml (listSessions, getSessionSeatMap). Публічні, без токена.
const express = require('express');

function createSessionsRouter({ catalogService }) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    res.status(200).json(catalogService.listSessions());
  });

  router.get('/:sessionId/seats', (req, res) => {
    const id = /^\d+$/.test(req.params.sessionId) ? Number(req.params.sessionId) : NaN;
    res.status(200).json(catalogService.getSeatMap(id));
  });

  return router;
}

module.exports = { createSessionsRouter };
