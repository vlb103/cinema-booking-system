// Робота з таблицею halls.
const { NotImplementedError } = require('../../errors');

// Місткість рахує сервер (ADD-07).
function toHall(row) {
  return {
    id: row.id,
    name: row.name,
    rowsCount: row.rows_count,
    seatsPerRow: row.seats_per_row,
    capacity: row.rows_count * row.seats_per_row,
  };
}

function createHallsRepository(db) {
  return {
    listHalls() {
      return db.prepare('SELECT * FROM halls ORDER BY id').all().map(toHall);
    },
    findHallById(id) {
      const row = db.prepare('SELECT * FROM halls WHERE id = ?').get(id);
      return row ? toHall(row) : null;
    },
    // Наступний раунд (адміністрування)
    createHall() { throw new NotImplementedError('hallsRepository.createHall'); },
  };
}

module.exports = { createHallsRepository, toHall };
