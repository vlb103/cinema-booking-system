// Правила часу і стану сеансу, спільні для бронювання і скасування.

// Сеанс почався, якщо T поточний >= T сеансу. Момент початку вже вважається початком
// (REQ-F-012, BDD-сценарій 4, ADD-06, ADD-12).
function hasStarted(session, now) {
  return now >= new Date(session.startTime);
}

// Бронювати можна лише активний сеанс, який ще не почався (ADD-06).
function isBookable(session, now) {
  return session.status === 'ACTIVE' && !hasStarted(session, now);
}

module.exports = { hasStarted, isBookable };
