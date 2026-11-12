// Робота з таблицею films.
const { NotImplementedError } = require('../../errors');

function toFilm(row) {
  const film = { id: row.id, title: row.title, durationMinutes: row.duration_minutes };
  if (row.description != null) film.description = row.description;
  return film;
}

function createFilmsRepository(db) {
  return {
    listFilms() {
      return db.prepare('SELECT * FROM films ORDER BY id').all().map(toFilm);
    },
    // Наступний раунд (адміністрування)
    createFilm() { throw new NotImplementedError('filmsRepository.createFilm'); },
    updateFilm() { throw new NotImplementedError('filmsRepository.updateFilm'); },
    findFilmById() { throw new NotImplementedError('filmsRepository.findFilmById'); },
  };
}

module.exports = { createFilmsRepository, toFilm };
