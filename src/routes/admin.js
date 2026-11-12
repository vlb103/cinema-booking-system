// Маршрути адміністратора за docs/api/openapi.yaml. Доступні лише ролі ADMIN (REQ-F-006, REQ-NF-003).
// Створення і редагування додаються в раунді адміністрування.
const express = require('express');

function createAdminRouter({ auth, adminService }) {
  const router = express.Router();
  router.use(auth.requireAuth, auth.requireRole('ADMIN'));

  router.get('/films', (_req, res) => {
    res.status(200).json(adminService.listFilms());
  });

  router.get('/halls', (_req, res) => {
    res.status(200).json(adminService.listHalls());
  });

  return router;
}

module.exports = { createAdminRouter };
