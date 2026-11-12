-- Схема БД Cinema Booking System v1 (сутності за ADD-07 і openapi.yaml).
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,           -- REQ-F-004 внутрішній числовий ID
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,                            -- пароль у відкритому вигляді не зберігається
  role          TEXT    NOT NULL CHECK (role IN ('USER', 'ADMIN')),
  created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT    PRIMARY KEY,                            -- зберігається геш токена, не сам токен
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS films (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT    NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 1),
  description      TEXT
);

CREATE TABLE IF NOT EXISTS halls (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  rows_count    INTEGER NOT NULL CHECK (rows_count >= 1),
  seats_per_row INTEGER NOT NULL CHECK (seats_per_row >= 1)
);

CREATE TABLE IF NOT EXISTS sessions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  film_id             INTEGER NOT NULL REFERENCES films(id),
  hall_id             INTEGER NOT NULL REFERENCES halls(id),
  start_time          TEXT    NOT NULL,                      -- ISO-8601 UTC
  status              TEXT    NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED')),
  cancellation_reason TEXT
);

CREATE TABLE IF NOT EXISTS bookings (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id),
  session_id          INTEGER NOT NULL REFERENCES sessions(id),
  status              TEXT    NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED')),
  created_at          TEXT    NOT NULL,
  cancelled_at        TEXT,
  cancellation_reason TEXT
);

CREATE TABLE IF NOT EXISTS booking_seats (
  booking_id  INTEGER NOT NULL REFERENCES bookings(id),
  session_id  INTEGER NOT NULL REFERENCES sessions(id),
  seat_row    INTEGER NOT NULL,
  seat_number INTEGER NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,                    -- 1 поки бронювання активне
  PRIMARY KEY (booking_id, seat_row, seat_number)
);

-- Одне місце сеансу може мати лише одне активне бронювання (REQ-F-009, REQ-NF-006).
CREATE UNIQUE INDEX IF NOT EXISTS ux_active_seat
  ON booking_seats (session_id, seat_row, seat_number) WHERE active = 1;
