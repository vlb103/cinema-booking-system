// Маршрути адміністратора за docs/api/openapi.yaml. Доступні лише ролі ADMIN (REQ-F-006, REQ-NF-003).
const express = require('express');
const { parseId } = require('./params');

function createAdminRouter({ auth, adminService }) {
  const router = express.Router();
  router.use(auth.requireAuth, auth.requireRole('ADMIN'));

  router.get('/films', (_req, res) => {
    res.status(200).json(adminService.listFilms());
  });

  router.post('/films', (req, res) => {
    res.status(201).json(adminService.createFilm(req.user, req.body || {}));
  });

  router.patch('/films/:filmId', (req, res) => {
    res.status(200).json(adminService.updateFilm(req.user, parseId(req.params.filmId), req.body || {}));
  });

  router.get('/halls', (_req, res) => {
    res.status(200).json(adminService.listHalls());
  });

  router.post('/halls', (req, res) => {
    res.status(201).json(adminService.createHall(req.user, req.body || {}));
  });

  router.post('/sessions', (req, res) => {
    res.status(201).json(adminService.createSession(req.user, req.body || {}));
  });

  router.patch('/sessions/:sessionId', (req, res) => {
    res.status(200).json(adminService.updateSession(req.user, parseId(req.params.sessionId), req.body || {}));
  });

  router.post('/sessions/:sessionId/cancel', (req, res) => {
    res.status(200).json(adminService.cancelSession(req.user, parseId(req.params.sessionId), req.body || {}));
  });

  return router;
}

module.exports = { createAdminRouter };
