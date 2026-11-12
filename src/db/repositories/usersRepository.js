// Робота з таблицями users і auth_tokens.

function toUser(row) {
  return row ? { id: row.id, email: row.email, role: row.role, passwordHash: row.password_hash } : null;
}

function createUsersRepository(db) {
  return {
    createUser({ email, passwordHash, role, createdAt }) {
      const info = db.prepare('INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)')
        .run(email, passwordHash, role, createdAt);
      return Number(info.lastInsertRowid);
    },

    findByEmail(email) {
      return toUser(db.prepare('SELECT * FROM users WHERE email = ?').get(email));
    },

    findById(id) {
      return toUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    },

    countAdmins() {
      return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'ADMIN'").get().n;
    },

    saveToken({ tokenHash, userId, createdAt }) {
      db.prepare('INSERT INTO auth_tokens (token_hash, user_id, created_at) VALUES (?, ?, ?)')
        .run(tokenHash, userId, createdAt);
    },

    findUserByTokenHash(tokenHash) {
      return toUser(db.prepare(
        'SELECT u.* FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?',
      ).get(tokenHash));
    },
  };
}

module.exports = { createUsersRepository };
