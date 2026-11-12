// Робота з таблицею films.

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
      const keys = Object.keys(fields).filter((k) => COLUMNS[k]);
      const sets = keys.map((k) => `${COLUMNS[k]} = ?`).join(', ');
      db.prepare(`UPDATE films SET ${sets} WHERE id = ?`).run(...keys.map((k) => fields[k]), id);
      return findFilmById(id);
    },
  };
}

module.exports = { createFilmsRepository, toFilm };
