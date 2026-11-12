// Маршрути адміністратора за docs/api/openapi.yaml. Доступні лише ролі ADMIN (REQ-F-006, REQ-NF-003).
const express = require('express');
const { parseId, respond, bodyOf } = require('./helpers');

function createAdminRouter({ auth, adminService }) {
  const router = express.Router();
  router.use(auth.requireAuth, auth.requireRole('ADMIN'));

  router.get('/films', respond(200, () => adminService.listFilms()));
  router.post('/films', respond(201, (req) => adminService.createFilm(req.user, bodyOf(req))));
  router.patch('/films/:filmId', respond(200, (req) => adminService.updateFilm(req.user, parseId(req.params.filmId), bodyOf(req))));

  router.get('/halls', respond(200, () => adminService.listHalls()));
  router.post('/halls', respond(201, (req) => adminService.createHall(req.user, bodyOf(req))));

  router.post('/sessions', respond(201, (req) => adminService.createSession(req.user, bodyOf(req))));
  router.patch('/sessions/:sessionId', respond(200, (req) => adminService.updateSession(req.user, parseId(req.params.sessionId), bodyOf(req))));
  router.post('/sessions/:sessionId/cancel', respond(200, (req) => adminService.cancelSession(req.user, parseId(req.params.sessionId), bodyOf(req))));

  return router;
}

module.exports = { createAdminRouter };
