// Раунд 1. Реєстрація користувача.
// Джерела: SRS REQ-F-003, REQ-F-004, REQ-NF-005, ADD-05, openapi registerUser і RegisterRequest
// (email format, maxLength 254, password minLength 8, maxLength 128),
// сценарії P-03, N-18, N-19, N-20, N-21, тікети T-12, T-14.
const { createTestContext } = require('../helpers/testContext');
const { register, login, uniqueEmail, emailOfLength } = require('../helpers/api');

const SENSITIVE_KEYS = ['password', 'passwordHash', 'password_hash', 'accessToken', 'token'];

describe('POST /auth/register (registerUser)', () => {
  describe('позитивні випадки', () => {
    test('[REQ-F-003][P-03] коректні email і пароль створюють обліковий запис 201 за схемою User', async () => {
      const ctx = createTestContext();
      const email = uniqueEmail();

      const res = await register(ctx.app, { email, password: 'secret123' });

      expect(res.status).toBe(201);
      expect(res).toSatisfyApiSpec();
      expect(res.body).toMatchObject({ email, role: 'USER' });
    });

    test('[REQ-F-003][ADD-05] відповідь не містить пароля чи його гешу', async () => {
      const ctx = createTestContext();

      const res = await register(ctx.app, { email: uniqueEmail(), password: 'secret123' });

      expect(res.status).toBe(201);
      for (const key of SENSITIVE_KEYS) expect(res.body).not.toHaveProperty(key);
      expect(JSON.stringify(res.body)).not.toContain('secret123');
    });

    test('[REQ-F-003][ADD-05] реєстрація не виконує вхід автоматично, токен не видається', async () => {
      const ctx = createTestContext();

      const res = await register(ctx.app, { email: uniqueEmail(), password: 'secret123' });

      expect(res.status).toBe(201);
      expect(res.body).not.toHaveProperty('accessToken');
      expect(res.headers).not.toHaveProperty('set-cookie');
    });

    test('[REQ-F-004][T-12] ID є додатним цілим числом і унікальний для кожного облікового запису', async () => {
      const ctx = createTestContext();

      const a = await register(ctx.app, { email: uniqueEmail('a'), password: 'secret123' });
      const b = await register(ctx.app, { email: uniqueEmail('b'), password: 'secret123' });

      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(Number.isInteger(a.body.id)).toBe(true);
      expect(Number.isInteger(b.body.id)).toBe(true);
      expect(a.body.id).toBeGreaterThan(0);
      expect(b.body.id).not.toBe(a.body.id);
    });

    test('[REQ-F-004][T-12] ID незмінний, при вході повертається той самий ID, що й при реєстрації', async () => {
      const ctx = createTestContext();
      const email = uniqueEmail();

      const reg = await register(ctx.app, { email, password: 'secret123' });
      const first = await login(ctx.app, { email, password: 'secret123' });
      const second = await login(ctx.app, { email, password: 'secret123' });

      expect(reg.status).toBe(201);
      expect(first.body.user.id).toBe(reg.body.id);
      expect(second.body.user.id).toBe(reg.body.id);
    });

    test('[REQ-NF-005][T-14][N-21] поле role ADMIN у запиті ігнорується, створюється USER', async () => {
      const ctx = createTestContext();
      const email = uniqueEmail('hacker');

      const res = await register(ctx.app, { email, password: 'secret123', role: 'ADMIN' });

      expect(res.status).toBe(201);
      expect(res).toSatisfyApiSpec();
      expect(res.body.role).toBe('USER');
      const row = ctx.db.prepare('SELECT role FROM users WHERE email = ?').get(email);
      expect(row.role).toBe('USER');
    });

    test('[REQ-NF-005][T-14] після входу користувач, що передав role ADMIN, має роль USER', async () => {
      const ctx = createTestContext();
      const email = uniqueEmail('hacker');
      await register(ctx.app, { email, password: 'secret123', role: 'ADMIN' });

      const res = await login(ctx.app, { email, password: 'secret123' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('USER');
    });
  });

  describe('граничні випадки', () => {
    test.each([
      [8, 201],
      [128, 201],
    ])('[REQ-F-003][ADD-05] пароль довжиною %i символів приймається (%i)', async (length, expected) => {
      const ctx = createTestContext();

      const res = await register(ctx.app, { email: uniqueEmail(), password: 'p'.repeat(length) });

      expect(res.status).toBe(expected);
      expect(res).toSatisfyApiSpec();
    });

    test.each([
      [7],
      [129],
    ])('[REQ-F-003][ADD-05][N-19] пароль довжиною %i символів відхиляється 400 VALIDATION_ERROR', async (length) => {
      const ctx = createTestContext();

      const res = await register(ctx.app, { email: uniqueEmail(), password: 'p'.repeat(length) });

      expect(res.status).toBe(400);
      expect(res).toSatisfyApiSpec();
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('[REQ-F-003][ADD-05] email довжиною 254 символи приймається', async () => {
      const ctx = createTestContext();

      const res = await register(ctx.app, { email: emailOfLength(254), password: 'secret123' });

      expect(res.status).toBe(201);
      expect(res).toSatisfyApiSpec();
    });

    test('[REQ-F-003][ADD-05] email довжиною 255 символів відхиляється 400 VALIDATION_ERROR', async () => {
      const ctx = createTestContext();

      const res = await register(ctx.app, { email: emailOfLength(255), password: 'secret123' });

      expect(res.status).toBe(400);
      expect(res).toSatisfyApiSpec();
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('негативні випадки', () => {
    test.each([
      ['not-an-email'],
      ['user@'],
      ['@example.com'],
      ['user example@example.com'],
      [''],
    ])('[REQ-F-003][N-18] некоректний email "%s" відхиляється 400 VALIDATION_ERROR', async (email) => {
      const ctx = createTestContext();

      const res = await register(ctx.app, { email, password: 'secret123' });

      expect(res.status).toBe(400);
      expect(res).toSatisfyApiSpec();
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test.each([
      ['без email', { password: 'secret123' }],
      ['без пароля', { email: 'nopass@example.com' }],
      ['порожнє тіло', {}],
      ['пароль не рядок', { email: 'num@example.com', password: 12345678 }],
      ['email не рядок', { email: 42, password: 'secret123' }],
    ])('[REQ-F-003][ADD-03] запит %s відхиляється 400 VALIDATION_ERROR', async (_name, body) => {
      const ctx = createTestContext();

      const res = await register(ctx.app, body);

      expect(res.status).toBe(400);
      expect(res).toSatisfyApiSpec();
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('[REQ-F-003][N-20][ADD-05] повторна реєстрація того самого email повертає 409 EMAIL_ALREADY_EXISTS', async () => {
      const ctx = createTestContext();
      const email = uniqueEmail();
      await register(ctx.app, { email, password: 'secret123' });

      const res = await register(ctx.app, { email, password: 'another123' });

      expect(res.status).toBe(409);
      expect(res).toSatisfyApiSpec();
      expect(res.body.code).toBe('EMAIL_ALREADY_EXISTS');
      expect(ctx.db.prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?').get(email).n).toBe(1);
    });

    test('[REQ-F-003][ADD-05] невдала реєстрація не створює запис у БД', async () => {
      const ctx = createTestContext();
      const before = ctx.db.prepare('SELECT COUNT(*) AS n FROM users').get().n;

      const res = await register(ctx.app, { email: 'short@example.com', password: '123' });

      expect(res.status).toBe(400);
      expect(ctx.db.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(before);
    });
  });
});
