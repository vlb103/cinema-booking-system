// Складання Express-застосунку. Залежності передаються ззовні, щоб тести
// могли підставити БД у пам'яті, фіктивний годинник і тимчасовий файл логу.
const express = require('express');
const config = require('./config');
const { systemClock } = require('./clock');
const { createLogger } = require('./logging/logger');
const { createUsersRepository } = require('./db/repositories/usersRepository');
const { createFilmsRepository } = require('./db/repositories/filmsRepository');
const { createHallsRepository } = require('./db/repositories/hallsRepository');
const { createSessionsRepository } = require('./db/repositories/sessionsRepository');
const { createBookingsRepository } = require('./db/repositories/bookingsRepository');
const { createAuthService } = require('./services/authService');
const { createCatalogService } = require('./services/catalogService');
const { createAdminService } = require('./services/adminService');
const { createBookingService } = require('./services/bookingService');
const { createAuthMiddleware } = require('./middleware/auth');
const { createErrorHandler } = require('./middleware/errorHandler');
const { createAuthRouter } = require('./routes/auth');
const { createSessionsRouter } = require('./routes/sessions');
const { createBookingsRouter } = require('./routes/bookings');
const { createAdminRouter } = require('./routes/admin');

/**
 * @param {object} deps
 * @param {import('better-sqlite3').Database} deps.db
 * @param {{now: () => Date}} [deps.clock]
 * @param {string} [deps.logFilePath]
 * @param {{email: string, password: string}} [deps.admin] початковий адміністратор
 */
function createApp({ db, clock = systemClock, logFilePath = config.logFilePath, admin = config.admin } = {}) {
  const logger = createLogger({ filePath: logFilePath, clock });

  const usersRepository = createUsersRepository(db);
  const filmsRepository = createFilmsRepository(db);
  const hallsRepository = createHallsRepository(db);
  const sessionsRepository = createSessionsRepository(db);
  const bookingsRepository = createBookingsRepository(db);

  const authService = createAuthService({ usersRepository, logger, clock });
  const catalogService = createCatalogService({ sessionsRepository, hallsRepository, bookingsRepository, clock });
  const adminService = createAdminService({ filmsRepository, hallsRepository });
  const bookingService = createBookingService({ bookingsRepository, sessionsRepository, hallsRepository, logger, clock });
  const auth = createAuthMiddleware({ authService, logger });

  authService.ensureInitialAdmin(admin);

  const app = express();
  app.use(express.json());

  const deps = { authService, catalogService, adminService, bookingService, auth };
  const api = express.Router();
  api.use('/auth', createAuthRouter(deps));
  api.use('/sessions', createSessionsRouter(deps));
  api.use('/bookings', createBookingsRouter(deps));
  api.use('/admin', createAdminRouter(deps));
  app.use(config.apiBasePath, api);

  app.use(createErrorHandler({ logger }));
  return app;
}

module.exports = { createApp };
