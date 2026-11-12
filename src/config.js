const path = require('path');

const root = path.resolve(__dirname, '..');

module.exports = {
  port: Number(process.env.PORT || 8080),
  apiBasePath: '/api/v1',
  dbPath: process.env.DB_PATH || path.join(root, 'data', 'cinema.db'),
  // Лог системи (REQ-LOG-004). Тести пишуть у тимчасові файли, а не сюди.
  logFilePath: process.env.LOG_FILE || path.join(root, 'logs', 'system', 'app.log'),
  // Єдиний адміністратор створюється під час первинного налаштування (SRS §2.2).
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@cinema.local',
    password: process.env.ADMIN_PASSWORD || 'ChangeMe123',
  },
};
