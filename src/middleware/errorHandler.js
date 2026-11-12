// Перетворення помилок на модель Error (ADD-03) і запис SYSTEM_ERROR у лог (REQ-LOG-001 п.5).
const { ApiError } = require('../errors');
const { EVENT_TYPES, STATUSES } = require('../logging/events');

function createErrorHandler({ logger }) {
  // eslint-disable-next-line no-unused-vars
  return function errorHandler(err, req, res, next) {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ code: err.code, message: err.message, details: err.details });
    }
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Некоректний JSON у тілі запиту', details: [] });
    }
    try {
      logger.log({
        event_type: EVENT_TYPES.SYSTEM_ERROR,
        status: STATUSES.ERROR,
        user_id: req.user ? req.user.id : null,
        entity_ids: { method: req.method, path: req.originalUrl },
        reason: err && err.message ? err.message : String(err),
      });
    } catch (_) {
      // збій логера не повинен ламати відповідь 500
    }
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Внутрішня помилка сервера', details: [] });
  };
}

module.exports = { createErrorHandler };
