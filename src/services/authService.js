// Реєстрація, вхід, перевірка токена, створення початкового адміністратора
// (REQ-F-003, REQ-F-004, REQ-NF-005, ADD-01, ADD-05, SRS §2.2).
const crypto = require('crypto');
const { ApiError } = require('../errors');
const { isoNow } = require('../clock');
const { EVENT_TYPES, STATUSES } = require('../logging/events');
const { isEmail } = require('./validation');

const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// У БД зберігається лише геш токена.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role };
}

function registrationErrors(body) {
  const details = [];
  if (!isEmail(body.email)) details.push('email: некоректний формат');
  else if (body.email.length > EMAIL_MAX) details.push(`email: довше за ${EMAIL_MAX} символи`);
  if (typeof body.password !== 'string') details.push('password: обов\'язкове рядкове поле');
  else if (body.password.length < PASSWORD_MIN || body.password.length > PASSWORD_MAX) {
    details.push(`password: довжина від ${PASSWORD_MIN} до ${PASSWORD_MAX} символів`);
  }
  return details;
}

function loginErrors(body) {
  const details = [];
  if (!isEmail(body.email)) details.push('email: некоректний формат');
  if (typeof body.password !== 'string' || body.password.length === 0) details.push("password: обов'язкове рядкове поле");
  return details;
}

const isUniqueViolation = (err) => Boolean(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE';

function createAuthService({ usersRepository, logger, clock }) {
  function logRegistration(status, { userId = null, reason = null } = {}) {
    logger.log({
      event_type: EVENT_TYPES.USER_REGISTERED,
      status,
      user_id: userId,
      entity_ids: userId ? { userId } : {},
      reason,
    });
  }

  function emailTaken() {
    logRegistration(STATUSES.REJECTED, { reason: 'Email вже зареєстровано' });
    return new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Обліковий запис з таким email вже існує');
  }

  function createAccount(email, password, role) {
    return usersRepository.createUser({ email, passwordHash: hashPassword(password), role, createdAt: isoNow(clock) });
  }

  function register(body = {}) {
    const details = registrationErrors(body);
    if (details.length) {
      logRegistration(STATUSES.REJECTED, { reason: `Помилка валідації: ${details.join(', ')}` });
      throw new ApiError(400, 'VALIDATION_ERROR', 'Некоректні дані запиту', details);
    }
    if (usersRepository.findByEmail(body.email)) throw emailTaken();
    // Поле role з запиту ігнорується, роль завжди USER (REQ-NF-005).
    let id;
    try {
      id = createAccount(body.email, body.password, 'USER');
    } catch (err) {
      // Одночасна реєстрація того самого email, перевірку випередив інший запит.
      if (isUniqueViolation(err)) throw emailTaken();
      throw err;
    }
    logRegistration(STATUSES.SUCCESS, { userId: id });
    return { id, email: body.email, role: 'USER' };
  }

  function login(body = {}) {
    const details = [];
    if (!isEmail(body.email)) details.push('email: некоректний формат');
    if (typeof body.password !== 'string' || body.password.length === 0) details.push('password: обов\'язкове рядкове поле');
    if (details.length) {
      logger.log({ event_type: EVENT_TYPES.USER_LOGIN, status: STATUSES.REJECTED, reason: `Помилка валідації: ${details.join(', ')}` });
      throw new ApiError(400, 'VALIDATION_ERROR', 'Некоректні дані запиту', details);
    }
    const user = usersRepository.findByEmail(body.email);
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      logger.log({ event_type: EVENT_TYPES.USER_LOGIN, status: STATUSES.REJECTED, reason: 'Невірний email або пароль' });
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Невірний email або пароль');
    }
    const accessToken = crypto.randomBytes(32).toString('base64url');
    usersRepository.saveToken({ tokenHash: hashToken(accessToken), userId: user.id, createdAt: isoNow(clock) });
    logger.log({ event_type: EVENT_TYPES.USER_LOGIN, status: STATUSES.SUCCESS, user_id: user.id, entity_ids: { userId: user.id } });
    return { accessToken, tokenType: 'Bearer', user: publicUser(user) };
  }

  // Повертає користувача за токеном або null.
  function authenticate(token) {
    if (!token) return null;
    const user = usersRepository.findUserByTokenHash(hashToken(token));
    return user ? publicUser(user) : null;
  }

  // Єдиний адміністратор створюється під час первинного налаштування (SRS §2.2).
  function ensureInitialAdmin({ email, password }) {
    if (usersRepository.countAdmins() > 0 || usersRepository.findByEmail(email)) return;
    const id = createAccount(email, password, 'ADMIN');
    logger.log({ event_type: EVENT_TYPES.ADMIN_INITIALIZED, status: STATUSES.SUCCESS, user_id: id, entity_ids: { userId: id } });
  }

  return { register, login, authenticate, ensureInitialAdmin };
}

module.exports = { createAuthService };
