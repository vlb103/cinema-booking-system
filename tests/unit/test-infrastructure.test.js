// Перевірка самої тестової інфраструктури (REQ-TDD-005, тікети T-81, T-04).
// Ці тести мають проходити вже на каркасі, бо вони перевіряють оточення, а не функції системи.
const request = require('supertest');
const { createTestContext, TEST_NOW, API } = require('../helpers/testContext');

describe('Тестове оточення', () => {
  test('[REQ-TDD-005][T-81] кожен тест отримує ізольовану БД у пам\'яті зі схемою', () => {
    const a = createTestContext();
    const b = createTestContext();
    a.db.prepare("INSERT INTO films (title, duration_minutes) VALUES ('A', 90)").run();

    const tables = a.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);

    expect(tables).toEqual(expect.arrayContaining(['users', 'auth_tokens', 'films', 'halls', 'sessions', 'bookings', 'booking_seats']));
    expect(a.db.prepare('SELECT COUNT(*) AS n FROM films').get().n).toBe(1);
    expect(b.db.prepare('SELECT COUNT(*) AS n FROM films').get().n).toBe(0);
  });

  test('[REQ-TDD-005][T-81] фіктивний годинник керує поточним часом', () => {
    const ctx = createTestContext();

    expect(ctx.clock.now().toISOString()).toBe(TEST_NOW);
    ctx.clock.advance(1000);
    expect(ctx.clock.now().toISOString()).toBe('2026-11-12T12:00:01.000Z');
  });

  test('[REQ-TDD-005][T-04] раннер виконує паралельні HTTP-запити до застосунку', async () => {
    const ctx = createTestContext();

    const responses = await Promise.all(Array.from({ length: 10 }, () => request(ctx.app).get(`${API}/sessions`)));

    expect(responses).toHaveLength(10);
    for (const r of responses) expect(typeof r.status).toBe('number');
  });
});
