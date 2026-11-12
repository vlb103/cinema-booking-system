// Робота з таблицею films.
const { updateColumns } = require('./sql');

function toFilm(row) {
  const film = { id: row.id, title: row.title, durationMinutes: row.duration_minutes };
  if (row.description != null) film.description = row.description;
  return film;
}

const COLUMNS = { title: 'title', durationMinutes: 'duration_minutes', description: 'description' };

function createFilmsRepository(db) {
  function findFilmById(id) {
    const row = db.prepare('SELECT * FROM films WHERE id = ?').get(id);
    return row ? toFilm(row) : null;
  }

  return {
    listFilms() {
      return db.prepare('SELECT * FROM films ORDER BY id').all().map(toFilm);
    },

    findFilmById,

    createFilm({ title, durationMinutes, description = null }) {
      const id = Number(db.prepare('INSERT INTO films (title, duration_minutes, description) VALUES (?, ?, ?)')
        .run(title, durationMinutes, description).lastInsertRowid);
      return findFilmById(id);
    },

    // Змінює лише передані поля (ADD-13).
    updateFilm(id, fields) {
      updateColumns(db, 'films', COLUMNS, id, fields);
      return findFilmById(id);
    },
  };
}

module.exports = { createFilmsRepository, toFilm };
