// Точка входу: запуск сервера з файловою БД.
const config = require('./config');
const { openDatabase } = require('./db/connection');
const { createApp } = require('./app');

const db = openDatabase(config.dbPath);
const app = createApp({ db });

app.listen(config.port, () => {
  console.log(`Cinema Booking System API: http://localhost:${config.port}${config.apiBasePath}`);
});
