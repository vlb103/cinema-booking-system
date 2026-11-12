// Маршрути Auth за docs/api/openapi.yaml (registerUser, loginUser).
const express = require('express');
const { respond, bodyOf } = require('./helpers');

function createAuthRouter({ authService }) {
  const router = express.Router();

  router.post('/register', respond(201, (req) => authService.register(bodyOf(req))));
  router.post('/login', respond(200, (req) => authService.login(bodyOf(req))));

  return router;
}

module.exports = { createAuthRouter };
