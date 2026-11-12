// Керування фільмами, залами, сеансами (REQ-F-015..REQ-F-019).
// У раунді 1 лише перегляд, потрібний для перевірки доступу ADMIN (REQ-F-006).
const { NotImplementedError } = require('../errors');

function createAdminService({ filmsRepository, hallsRepository }) {
  return {
    listFilms: () => filmsRepository.listFilms(),
    listHalls: () => hallsRepository.listHalls(),
    // Наступний раунд (адміністрування)
    createFilm() { throw new NotImplementedError('adminService.createFilm'); },
    updateFilm() { throw new NotImplementedError('adminService.updateFilm'); },
    createHall() { throw new NotImplementedError('adminService.createHall'); },
    createSession() { throw new NotImplementedError('adminService.createSession'); },
    updateSession() { throw new NotImplementedError('adminService.updateSession'); },
    cancelSession() { throw new NotImplementedError('adminService.cancelSession'); },
  };
}

module.exports = { createAdminService };
