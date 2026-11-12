// Ізольоване оточення для інтеграційних тестів, у кожного тесту своє.
// БД SQLite у пам'яті, фіктивний годинник, тимчасовий файл логу.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDatabase } = require('../../src/db/connection');
const { createApp } = require('../../src/app');
const { createFakeClock } = require('./clock');

const API = '/api/v1';
const TEST_NOW = '2026-11-12T12:00:00.000Z';
const TEST_ADMIN = Object.freeze({ email: 'admin@cinema.test', password: 'AdminPass123' });

let counter = 0;

function tempLogFile() {
  counter += 1;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbs-log-'));
  return path.join(dir, `app-${process.pid}-${counter}.log`);
}

function readLog(logFilePath) {
  if (!fs.existsSync(logFilePath)) return [];
  return fs.readFileSync(logFilePath, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
}

function readLogRaw(logFilePath) {
  return fs.existsSync(logFilePath) ? fs.readFileSync(logFilePath, 'utf8') : '';
}

function createTestContext({ now = TEST_NOW, logFilePath = tempLogFile(), db = openDatabase(':memory:') } = {}) {
  const clock = createFakeClock(now);
  const app = createApp({ db, clock, logFilePath, admin: TEST_ADMIN });
  return {
    app,
    db,
    clock,
    logFilePath,
    readLog: () => readLog(logFilePath),
    readLogRaw: () => readLogRaw(logFilePath),
  };
}

module.exports = { API, TEST_NOW, TEST_ADMIN, createTestContext, tempLogFile, readLog, readLogRaw };
