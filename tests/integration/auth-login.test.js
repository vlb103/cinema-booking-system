// Раунд 1. Вхід за email і паролем, початковий адміністратор.
// Джерела: SRS REQ-F-003, REQ-F-006, §2.2 (єдиний адміністратор при налаштуванні), ADD-01,
// openapi loginUser і LoginResponse, сценарії P-04, N-22, тікет T-10.
const { createTestContext, TEST_ADMIN } = require('../helpers/testContext');
const { register, login, uniqueEmail } = require('../helpers/api');

describe('POST /auth/login (loginUser)', () => {
  describe('позитивні випадки', () => {
    test('[REQ-F-003][P-04][ADD-01] коректні дані дають 200 LoginResponse з Bearer-токеном', async () => {
      const ctx = createTestContext();
      const email = uniqueEmail();
      const reg = await register(ctx.app, { email, password: 'secret123' });

      const res = await login(ctx.app, { email, password: 'secret123' });

      expect(res.status).toBe(200);
      expect(res).toSatisfyApiSpec();
      expect(res.body.tokenType).toBe('Bearer');
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.accessToken.length).toBeGreaterThan(0);
      expect(res.body.user).toEqual({ id: reg.body.id, email, role: 'USER' });
    });

    test('[REQ-F-003][ADD-01] кожен вхід видає окремий токен', async () => {
      const ctx = createTestContext();
      const email = uniqueEmail();
      await register(ctx.app, { email, password: 'secret123' });

      const first = await login(ctx.app, { email, password: 'secret123' });
      const second = await login(ctx.app, { email, password: 'secret123' });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.accessToken).not.toBe(first.body.accessToken);
    });

    test('[REQ-F-003] токен не містить пароля у відкритому чи base64 вигляді', async () => {
      const ctx = createTestContext();
      const email = uniqueEmail();
      const password = 'secret123';
      await register(ctx.app, { email, password });

      const res = await login(ctx.app, { email, password });

      expect(res.status).toBe(200);
      const token = res.body.accessToken;
      expect(token).not.toContain(password);
      expect(token).not.toContain(Buffer.from(password).toString('base64').replace(/=+$/, ''));
      expect(token).not.toContain(Buffer.from(password).toString('base64url'));
    });

    test('[REQ-F-006][§2.2] початковий адміністратор створюється при налаштуванні і входить з роллю ADMIN', async () => {
      const ctx = createTestContext();

      const res = await login(ctx.app, TEST_ADMIN);

      expect(res.status).toBe(200);
      expect(res).toSatisfyApiSpec();
      expect(res.body.user).toMatchObject({ email: TEST_ADMIN.email, role: 'ADMIN' });
    });

    test('[REQ-F-006][§2.2] у системі рівно один адміністратор', async () => {
      const ctx = createTestContext();
      await login(ctx.app, TEST_ADMIN);

      const n = ctx.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'ADMIN'").get().n;

      expect(n).toBe(1);
    });

    test('[REQ-F-006][REQ-NF-002][§2.2] повторний запуск застосунку на тій самій БД не створює другого адміністратора', async () => {
      const ctx = createTestContext();
      const restarted = createTestContext({ db: ctx.db });

      const res = await login(restarted.app, TEST_ADMIN);

      expect(res.status).toBe(200);
      expect(ctx.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'ADMIN'").get().n).toBe(1);
    });

    test('[REQ-F-006][§2.2] email адміністратора не можна зареєструвати повторно', async () => {
      const ctx = createTestContext();

      const res = await register(ctx.app, { email: TEST_ADMIN.email, password: 'secret123' });

      expect(res.status).toBe(409);
      expect(res).toSatisfyApiSpec();
      expect(res.body.code).toBe('EMAIL_ALREADY_EXISTS');
    });
  });

  describe('негативні випадки', () => {
    test('[REQ-F-003][N-22] невірний пароль дає 401 INVALID_CREDENTIALS', async () => {
      const ctx = createTestContext();
      const email = uniqueEmail();
      await register(ctx.app, { email, password: 'secret123' });

      const res = await login(ctx.app, { email, password: 'wrongpass' });

      expect(res.status).toBe(401);
      expect(res).toSatisfyApiSpec();
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body).not.toHaveProperty('accessToken');
    });

    test('[REQ-F-003] незареєстрований email дає ту саму відповідь 401 INVALID_CREDENTIALS, що й невірний пароль', async () => {
      const ctx = createTestContext();
      const email = uniqueEmail();
      await register(ctx.app, { email, password: 'secret123' });

      const wrongPass = await login(ctx.app, { email, password: 'wrongpass' });
      const unknown = await login(ctx.app, { email: uniqueEmail('nobody'), password: 'secret123' });

      expect(unknown.status).toBe(401);
      expect(unknown).toSatisfyApiSpec();
      expect(unknown.body.code).toBe('INVALID_CREDENTIALS');
      expect(unknown.body.message).toBe(wrongPass.body.message);
    });

    test('[REQ-F-003] пароль чутливий до регістру', async () => {
      const ctx = createTestContext();
      const email = uniqueEmail();
      await register(ctx.app, { email, password: 'Secret123' });

      const res = await login(ctx.app, { email, password: 'secret123' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    test.each([
      ['без пароля', { email: 'user@example.com' }],
      ['без email', { password: 'secret123' }],
      ['порожнє тіло', {}],
      ['некоректний email', { email: 'not-an-email', password: 'secret123' }],
    ])('[REQ-F-003][ADD-03] запит %s відхиляється 400 VALIDATION_ERROR', async (_name, body) => {
      const ctx = createTestContext();

      const res = await login(ctx.app, body);

      expect(res.status).toBe(400);
      expect(res).toSatisfyApiSpec();
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
