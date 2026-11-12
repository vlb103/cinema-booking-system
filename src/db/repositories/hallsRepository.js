// Робота з таблицею halls.

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
  function findHallById(id) {
    const row = db.prepare('SELECT * FROM halls WHERE id = ?').get(id);
    return row ? toHall(row) : null;
  }

  return {
    listHalls() {
      return db.prepare('SELECT * FROM halls ORDER BY id').all().map(toHall);
    },

    findHallById,

    createHall({ name, rowsCount, seatsPerRow }) {
      const id = Number(db.prepare('INSERT INTO halls (name, rows_count, seats_per_row) VALUES (?, ?, ?)')
        .run(name, rowsCount, seatsPerRow).lastInsertRowid);
      return findHallById(id);
    },
  };
}

module.exports = { createHallsRepository, toHall };
