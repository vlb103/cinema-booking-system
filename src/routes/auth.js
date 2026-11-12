// Маршрути Auth за docs/api/openapi.yaml (registerUser, loginUser).
const express = require('express');

function createAuthRouter({ authService }) {
  const router = express.Router();

  router.post('/register', (req, res) => {
    res.status(201).json(authService.register(req.body || {}));
  });

  router.post('/login', (req, res) => {
    res.status(200).json(authService.login(req.body || {}));
  });

  return router;
}

module.exports = { createAuthRouter };
