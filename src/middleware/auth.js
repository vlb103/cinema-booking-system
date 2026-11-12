// Перевірка Bearer-токена і ролі (ADD-01, REQ-F-003, REQ-F-006, REQ-NF-003).
// Роль береться лише з облікового запису на сервері, заголовки і тіло запиту на неї не впливають.
const { ApiError } = require('../errors');
const { EVENT_TYPES, STATUSES } = require('../logging/events');

const BEARER = /^Bearer ([^\s]+)$/;

function createAuthMiddleware({ authService, logger }) {
  function deny(req, userId, reason) {
    logger.log({
      event_type: EVENT_TYPES.ACCESS_DENIED,
      status: STATUSES.REJECTED,
      user_id: userId,
      entity_ids: { method: req.method, path: req.originalUrl },
      reason,
    });
  }

  function requireAuth(req, _res, next) {
    const match = BEARER.exec(req.get('Authorization') || '');
    const user = match ? authService.authenticate(match[1]) : null;
    if (!user) {
      deny(req, null, match ? 'Недійсний токен доступу' : 'Токен доступу відсутній');
      return next(new ApiError(401, 'UNAUTHORIZED', 'Потрібна автентифікація'));
    }
    req.user = user;
    return next();
  }

  function requireRole(role) {
    return function checkRole(req, _res, next) {
      if (req.user.role !== role) {
        deny(req, req.user.id, `Операція доступна лише ролі ${role}, роль користувача ${req.user.role}`);
        return next(new ApiError(403, 'FORBIDDEN', 'Доступ заборонено'));
      }
      return next();
    };
  }

  return { requireAuth, requireRole };
}

module.exports = { createAuthMiddleware };
