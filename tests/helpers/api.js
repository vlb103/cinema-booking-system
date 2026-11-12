// Допоміжні виклики API для тестів.
const request = require('supertest');
const { API } = require('./testContext');

let seq = 0;
function uniqueEmail(prefix = 'user') {
  seq += 1;
  return `${prefix}${seq}.${process.pid}@example.com`;
}

function register(app, body) {
  return request(app).post(`${API}/auth/register`).send(body);
}

function login(app, body) {
  return request(app).post(`${API}/auth/login`).send(body);
}

// Реєструє користувача і повертає { id, email, password, token }.
// Перевіряє коди відповіді, щоб тест падав з зрозумілою причиною вже на підготовці.
async function registerAndLogin(app, { email = uniqueEmail(), password = 'secret123' } = {}) {
  const reg = await register(app, { email, password });
  expect(reg.status).toBe(201);
  const log = await login(app, { email, password });
  expect(log.status).toBe(200);
  return { id: reg.body.id, email, password, token: log.body.accessToken };
}

async function loginAs(app, { email, password }) {
  const res = await login(app, { email, password });
  expect(res.status).toBe(200);
  return res.body.accessToken;
}

// Email заданої довжини з частинами, допустимими за RFC (локальна до 64, мітка домену до 63).
function emailOfLength(length) {
  const local = 'user';
  let remaining = length - local.length - 1 - '.com'.length;
  const labels = [];
  while (remaining > 0) {
    const size = Math.min(63, remaining);
    labels.push('d'.repeat(size));
    remaining -= size + 1;
    if (remaining === 0) { labels[labels.length - 1] = labels[labels.length - 1].slice(1); remaining = 0; }
  }
  const email = `${local}@${labels.join('.')}.com`;
  if (email.length !== length) throw new Error(`emailOfLength: got ${email.length}, want ${length}`);
  return email;
}

module.exports = { API, uniqueEmail, register, login, registerAndLogin, loginAs, emailOfLength };
