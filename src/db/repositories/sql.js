// Спільні помічники для репозиторіїв.

// Транзакція з блокуванням на запис від самого початку (BEGIN IMMEDIATE).
// Між перевіркою і записом інше з'єднання не може змінити ті самі дані (REQ-F-008, REQ-NF-006).
function immediateTransaction(db, fn) {
  const tx = db.transaction(fn);
  return (...args) => tx.immediate(...args);
}

// Часткове оновлення рядка: змінюються лише передані поля (ADD-13).
// columns задає відповідність полів API колонкам таблиці, інші поля ігноруються.
function updateColumns(db, table, columns, id, fields) {
  const keys = Object.keys(fields).filter((k) => columns[k]);
  if (!keys.length) return;
  const sets = keys.map((k) => `${columns[k]} = ?`).join(', ');
  db.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(...keys.map((k) => fields[k]), id);
}

module.exports = { immediateTransaction, updateColumns };
