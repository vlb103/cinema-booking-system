// Відкриття SQLite (better-sqlite3) і застосування схеми.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function openDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  // Кілька з'єднань до одного файлу чекають на блокування замість помилки SQLITE_BUSY (REQ-NF-006).
  db.pragma('busy_timeout = 5000');
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  return db;
}

module.exports = { openDatabase };
