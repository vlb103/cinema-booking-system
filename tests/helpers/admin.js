// Допоміжні функції для тестів раунду 3 (скасування і адміністрування).
const request = require('supertest');
const { API, TEST_ADMIN } = require('./testContext');

// Вхід адміністратора, повертає { id, token }.
async function adminLogin(app) {
  const res = await request(app).post(`${API}/auth/login`).send(TEST_ADMIN);
  expect(res.status).toBe(200);
  return { id: res.body.user.id, token: res.body.accessToken };
}

function asToken(token) {
  return (req) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
}

function cancelBooking(app, token, bookingId, body) {
  const req = asToken(token)(request(app).post(`${API}/bookings/${bookingId}/cancel`));
  return body === undefined ? req : req.send(body);
}

function adminCall(app, token, method, path, body) {
  const req = asToken(token)(request(app)[method](`${API}/admin${path}`));
  return body === undefined ? req : req.send(body);
}

function publicSessions(app) {
  return request(app).get(`${API}/sessions`);
}

module.exports = { adminLogin, cancelBooking, adminCall, publicSessions };
