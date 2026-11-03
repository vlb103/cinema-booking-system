# Сценарії перевірки контракту REST API (Cinema Booking System)

Джерела: `spec/srs.md` (BDD-сценарії §5.3, критерії прийняття §4, граничні випадки REQ-TDD-003), `docs/api/openapi.yaml`, `docs/api/api-model.md`.
Mock: Prism на `http://localhost:4010` за `docs/api/openapi.yaml`.

Позначки в колонці «Mock»:
- **Сам** означає, що Prism сам повертає очікувану відповідь. Успішні відповіді він бере з прикладів, 400 видає за схемою запиту (minItems, maxItems, uniqueItems, format email, minLength, minProperties, required), 401 видає за відсутністю Bearer-токена;
- **`Prefer: …`** означає, що mock не знає стану (зайняті місця, власник бронювання, поточний час, роль у токені, наявні користувачі, бронювання сеансу) і без заголовка повертає успіх. Тому потрібну відповідь треба попросити явно заголовком `Prefer: code=…, example=…`.

Токен у сценаріях будь-який, наприклад `Authorization: Bearer user-token`. Mock перевіряє лише його наявність, ролі не розрізняє.

## Таблиця 1 – Позитивні сценарії

| ID | Сценарій | REQ-ID | Основа в SRS | Запит | Токен | Тіло | Код | code помилки | Mock | Результат на mock | Примітка |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :---: | :--- |
| P-01 | Афіша без входу | REQ-F-001 | §4.1 критерій | `GET /sessions` | Ні | — | 200 | — | Сам | 200 ✅ | — |
| P-02 | Схема залу сеансу без входу | REQ-F-002 | §4.1 критерій | `GET /sessions/10/seats` | Ні | — | 200 | — | Сам | 200 ✅ | — |
| P-03 | Реєстрація | REQ-F-003, REQ-F-004 | §4.2 | `POST /auth/register` | Ні | `{"email":"user@example.com","password":"secret123"}` | 201 | — | Сам | 201 ✅ | Унікальність ID mock не перевіряє |
| P-04 | Вхід, отримання токена | REQ-F-003 | §4.2 | `POST /auth/login` | Ні | `{"email":"user@example.com","password":"secret123"}` | 200 | — | Сам | 200 ✅ | — |
| P-05 | Бронювання 1 місця (мінімум) | REQ-F-007, REQ-F-008 | §5.2 REQ-TDD-003 | `POST /bookings` | Так (USER) | `{"sessionId":10,"seats":[{"row":1,"number":1}]}` | 201 | — | Сам | 201 ✅ | — |
| P-06 | Бронювання 6 місць (максимум) | REQ-F-007, REQ-F-008 | §5.2 REQ-TDD-003 | `POST /bookings` | Так (USER) | `{"sessionId":10,"seats":[{"row":3,"number":1},{"row":3,"number":2},{"row":3,"number":3},{"row":3,"number":4},{"row":3,"number":5},{"row":3,"number":6}]}` | 201 | — | Сам | 201 ✅ | — |
| P-07 | Перегляд власних бронювань | REQ-F-020, REQ-F-005 | §3.1 п.4 | `GET /bookings` | Так (USER) | — | 200 | — | Сам | 200 ✅ | Що в списку лише свої, mock не перевіряє |
| P-08 | Скасування власного бронювання до початку сеансу | REQ-F-011, REQ-F-012, REQ-F-013 | BDD сценарій 3 | `POST /bookings/42/cancel` | Так (USER) | — | 200 | — | Сам | 200 ✅ | Звільнення місць у схемі залу mock не показує |
| P-09 | Повторне скасування того самого бронювання | REQ-F-014 | §4.4 критерій | `POST /bookings/42/cancel` | Так (USER) | — | 200 | — | Сам | 200 ✅ | Відсутність повторних змін mock не перевіряє |
| P-10 | Адмін переглядає фільми | REQ-F-015, REQ-F-006 | §3.2 п.1 | `GET /admin/films` | Так (ADMIN) | — | 200 | — | Сам | 200 ✅ | — |
| P-11 | Адмін додає фільм | REQ-F-015 | §3.2 п.1 | `POST /admin/films` | Так (ADMIN) | `{"title":"The Matrix","durationMinutes":136,"description":"Науково-фантастичний бойовик"}` | 201 | — | Сам | 201 ✅ | — |
| P-12 | Адмін редагує опис фільму | REQ-F-015 | §3.2 п.1 | `PATCH /admin/films/1` | Так (ADMIN) | `{"description":"Реставрована версія"}` | 200 | — | Сам | 200 ✅ | — |
| P-13 | Адмін створює зал | REQ-F-015 | §3.2 п.2 | `POST /admin/halls` | Так (ADMIN) | `{"name":"Зал 3","rowsCount":8,"seatsPerRow":10}` | 201 | — | Сам | 201 ✅ | — |
| P-14 | Адмін переглядає зали | REQ-F-015 | §3.2 п.2 | `GET /admin/halls` | Так (ADMIN) | — | 200 | — | Сам | 200 ✅ | — |
| P-15 | Адмін створює сеанс | REQ-F-015 | §4.5 критерій | `POST /admin/sessions` | Так (ADMIN) | `{"filmId":1,"hallId":2,"startTime":"2026-11-12T18:00:00Z"}` | 201 | — | Сам | 201 ✅ | Появу сеансу в афіші mock не показує |
| P-16 | Адмін змінює час сеансу без бронювань | REQ-F-016 | §4.5 критерій | `PATCH /admin/sessions/10` | Так (ADMIN) | `{"startTime":"2026-11-10T19:00:00Z"}` | 200 | — | Сам | 200 ✅ | — |
| P-17 | Адмін скасовує сеанс з причиною | REQ-F-018, REQ-F-019 | BDD сценарій 6 | `POST /admin/sessions/77/cancel` | Так (ADMIN) | `{"reason":"Аварійне відключення живлення"}` | 200 | — | Сам | 200 ✅ | Каскадне скасування бронювань mock не виконує |
| P-18 | Клієнт бачить причину скасування сеансу в кабінеті | REQ-F-020 | BDD сценарій 6 | `GET /bookings` | Так (USER) | — | 200 | — | Сам | 200 ✅ | Приклад містить бронювання з cancellationReason |

## Таблиця 2 – Негативні сценарії

| ID | Сценарій | REQ-ID | Основа в SRS | Запит | Токен | Тіло | Код | code помилки | Mock | Результат на mock | Примітка |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :---: | :--- |
| N-01 | Бронювання без токена | REQ-F-003 | §4.2 критерій | `POST /bookings` | Ні | `{"sessionId":10,"seats":[{"row":1,"number":1}]}` | 401 | UNAUTHORIZED | Сам | 401 ✅ | — |
| N-02 | Перегляд бронювань без токена | REQ-F-003 | §4.2 | `GET /bookings` | Ні | — | 401 | UNAUTHORIZED | Сам | 401 ✅ | — |
| N-03 | Скасування бронювання без токена | REQ-F-003 | §4.2 критерій | `POST /bookings/42/cancel` | Ні | — | 401 | UNAUTHORIZED | Сам | 401 ✅ | — |
| N-04 | Бронювання 0 місць | REQ-F-007 | §4.3 критерій, REQ-TDD-003 | `POST /bookings` | Так (USER) | `{"sessionId":10,"seats":[]}` | 400 | VALIDATION_ERROR | Сам | 400 ✅ | — |
| N-05 | Бронювання 7 місць | REQ-F-007 | §4.3 критерій, REQ-TDD-003 | `POST /bookings` | Так (USER) | `{"sessionId":10,"seats":[{"row":1,"number":1},{"row":1,"number":2},{"row":1,"number":3},{"row":1,"number":4},{"row":1,"number":5},{"row":1,"number":6},{"row":1,"number":7}]}` | 400 | VALIDATION_ERROR | Сам | 400 ✅ | — |
| N-06 | Одне місце двічі в запиті | REQ-F-007 | рішення 9 моделі API | `POST /bookings` | Так (USER) | `{"sessionId":10,"seats":[{"row":1,"number":1},{"row":1,"number":1}]}` | 400 | VALIDATION_ERROR | Сам | 400 ✅ | — |
| N-07 | Місце поза схемою залу | REQ-F-007 | рішення 9 моделі API | `POST /bookings` | Так (USER) | `{"sessionId":10,"seats":[{"row":99,"number":1}]}` | 400 | VALIDATION_ERROR | `Prefer: code=400` | 400 ✅ | Mock не знає розміру залу |
| N-08 | Місце вже зайняте іншим клієнтом | REQ-F-009 | BDD сценарій 1 | `POST /bookings` | Так (USER) | `{"sessionId":10,"seats":[{"row":2,"number":4}]}` | 409 | SEATS_TAKEN | `Prefer: code=409, example=seatsTaken` | 409 ✅ | Паралельні запити (1 успіх із 10) лише на реальному сервері |
| N-09 | Група місць, одне з яких зайняте | REQ-F-010 | BDD сценарій 2 | `POST /bookings` | Так (USER) | `{"sessionId":15,"seats":[{"row":1,"number":5},{"row":1,"number":6},{"row":1,"number":7}]}` | 409 | SEATS_TAKEN | `Prefer: code=409, example=seatsTaken` | 409 ✅ | Що місця 5 і 6 лишились вільні, mock не перевіряє |
| N-10 | Бронювання на скасований або розпочатий сеанс | REQ-F-008 | рішення 6 моделі API | `POST /bookings` | Так (USER) | `{"sessionId":77,"seats":[{"row":1,"number":1}]}` | 409 | SESSION_NOT_AVAILABLE | `Prefer: code=409, example=sessionNotAvailable` | 409 ✅ | — |
| N-11 | Бронювання на неіснуючий сеанс | REQ-F-008 | рішення 3 моделі API | `POST /bookings` | Так (USER) | `{"sessionId":9999,"seats":[{"row":1,"number":1}]}` | 404 | NOT_FOUND | `Prefer: code=404` | 404 ✅ | — |
| N-12 | Адміністратор створює бронювання | REQ-F-006 | §2.2 матриця RBAC | `POST /bookings` | Так (ADMIN) | `{"sessionId":10,"seats":[{"row":1,"number":1}]}` | 403 | FORBIDDEN | `Prefer: code=403` | 403 ✅ | Mock не розрізняє ролі в токені |
| N-13 | Скасування чужого бронювання | REQ-F-005, REQ-NF-004 | §4.2 критерій | `POST /bookings/43/cancel` | Так (USER) | — | 403 | FORBIDDEN | `Prefer: code=403` | 403 ✅ | Mock не знає власника бронювання |
| N-14 | Скасування точно в момент початку сеансу | REQ-F-012 | BDD сценарій 4 | `POST /bookings/43/cancel` | Так (USER) | — | 409 | CANCELLATION_DEADLINE_PASSED | `Prefer: code=409, example=deadlinePassed` | 409 ✅ | Mock не знає поточного часу |
| N-15 | Скасування після початку сеансу | REQ-F-012 | BDD сценарій 5 | `POST /bookings/44/cancel` | Так (USER) | — | 409 | CANCELLATION_DEADLINE_PASSED | `Prefer: code=409, example=deadlinePassed` | 409 ✅ | — |
| N-16 | Скасування неіснуючого бронювання | REQ-F-011 | рішення 3 моделі API | `POST /bookings/9999/cancel` | Так (USER) | — | 404 | NOT_FOUND | `Prefer: code=404` | 404 ✅ | — |
| N-17 | Схема залу неіснуючого сеансу | REQ-F-002 | рішення 3 моделі API | `GET /sessions/9999/seats` | Ні | — | 404 | NOT_FOUND | `Prefer: code=404` | 404 ✅ | — |
| N-18 | Реєстрація з некоректним email | REQ-F-003 | §3.1 п.2 | `POST /auth/register` | Ні | `{"email":"not-an-email","password":"secret123"}` | 400 | VALIDATION_ERROR | Сам | 400 ✅ | — |
| N-19 | Реєстрація з коротким паролем | REQ-F-003 | рішення 5 моделі API | `POST /auth/register` | Ні | `{"email":"user@example.com","password":"123"}` | 400 | VALIDATION_ERROR | Сам | 400 ✅ | — |
| N-20 | Реєстрація з уже зайнятим email | REQ-F-003 | рішення 5 моделі API | `POST /auth/register` | Ні | `{"email":"user@example.com","password":"secret123"}` | 409 | EMAIL_ALREADY_EXISTS | `Prefer: code=409` | 409 ✅ | Mock не знає наявних користувачів |
| N-21 | Реєстрація з полем role ADMIN | REQ-NF-005 | §7.2 критерій | `POST /auth/register` | Ні | `{"email":"hacker@example.com","password":"secret123","role":"ADMIN"}` | 201 | — (role USER у відповіді) | Сам | 201 ✅ | Mock повертає приклад з role USER, ігнорування поля перевіряє лише реальний сервер |
| N-22 | Вхід з невірним паролем | REQ-F-003 | §3.1 п.2 | `POST /auth/login` | Ні | `{"email":"user@example.com","password":"wrongpass"}` | 401 | INVALID_CREDENTIALS | `Prefer: code=401` | 401 ✅ | Mock не перевіряє пароль |
| N-23 | Адмін-операція без токена | REQ-F-006 | §4.2 | `POST /admin/films` | Ні | `{"title":"The Matrix","durationMinutes":136}` | 401 | UNAUTHORIZED | Сам | 401 ✅ | — |
| N-24 | Користувач викликає адмін-операцію | REQ-F-006, REQ-NF-003 | §4.2 критерій | `POST /admin/films` | Так (USER) | `{"title":"The Matrix","durationMinutes":136}` | 403 | FORBIDDEN | `Prefer: code=403` | 403 ✅ | Mock не розрізняє ролі в токені |
| N-25 | Фільм без назви | REQ-F-015 | модель API | `POST /admin/films` | Так (ADMIN) | `{"durationMinutes":136}` | 400 | VALIDATION_ERROR | Сам | 400 ✅ | — |
| N-26 | Зміна сеансу з активними бронюваннями | REQ-F-017 | BDD сценарій 6 | `PATCH /admin/sessions/77` | Так (ADMIN) | `{"hallId":1}` | 409 | SESSION_HAS_ACTIVE_BOOKINGS | `Prefer: code=409, example=hasActiveBookings` | 409 ✅ | Mock не знає бронювань сеансу |
| N-27 | Зміна сеансу з порожнім тілом | REQ-F-016 | рішення 13 моделі API | `PATCH /admin/sessions/10` | Так (ADMIN) | `{}` | 400 | VALIDATION_ERROR | Сам | 400 ✅ | — |
| N-28 | Зміна скасованого сеансу | REQ-F-017 | рішення 11 моделі API | `PATCH /admin/sessions/77` | Так (ADMIN) | `{"startTime":"2026-11-06T19:00:00Z"}` | 409 | SESSION_ALREADY_CANCELLED | `Prefer: code=409, example=alreadyCancelled` | 409 ✅ | — |
| N-29 | Скасування сеансу без поля причини | REQ-F-018 | §4.5 критерій, REQ-TDD-003 | `POST /admin/sessions/77/cancel` | Так (ADMIN) | `{}` | 400 | VALIDATION_ERROR | Сам | 400 ✅ | — |
| N-30 | Скасування сеансу з порожньою причиною | REQ-F-018 | §4.5 критерій | `POST /admin/sessions/77/cancel` | Так (ADMIN) | `{"reason":""}` | 400 | VALIDATION_ERROR | Сам | 400 ✅ | — |
| N-31 | Скасування сеансу з причиною лише з пробілів | REQ-F-018 | рішення 11 моделі API | `POST /admin/sessions/77/cancel` | Так (ADMIN) | `{"reason":"   "}` | 400 | VALIDATION_ERROR | `Prefer: code=400` | 400 ✅ | За схемою пробіли проходять, перевірка на сервері |
| N-32 | Повторне скасування сеансу | REQ-F-018 | рішення 11 моделі API | `POST /admin/sessions/77/cancel` | Так (ADMIN) | `{"reason":"Повтор"}` | 409 | SESSION_ALREADY_CANCELLED | `Prefer: code=409` | 409 ✅ | — |
| N-33 | Системна помилка сервера | REQ-LOG-001 | §6.1 п.5 | `GET /sessions` | Ні | — | 500 | INTERNAL_ERROR | `Prefer: code=500` | 500 ✅ | Спільна відповідь 500 |

## Підсумок

| | Усього | Mock сам | Потрібен `Prefer` |
| :--- | :---: | :---: | :---: |
| Позитивні | 18 | 18 | 0 |
| Негативні | 33 | 14 | 19 |
| Разом | 51 | 32 | 19 |

Усі 51 сценаріїв прогнано на mock, отримані коди і `code` помилки збіглися з очікуваними (51 з 51).
Контрольний прогін сценаріїв з `Prefer` без цього заголовка дав 200 або 201 в усіх 19 випадках. Це підтверджує, що mock сам ці помилки не відтворює.

Покриття BDD-сценаріїв SRS: сценарій 1 у N-08, сценарій 2 у N-09, сценарій 3 у P-08, сценарій 4 у N-14, сценарій 5 у N-15, сценарій 6 у P-17, P-18, N-26.
Граничні випадки REQ-TDD-003: 1 і 6 місць у P-05, P-06, 0 і 7 місць у N-04, N-05, зайняте місце в N-08, N-09, скасування в момент початку в N-14, ідемпотентність у P-09, зміна сеансу з бронюваннями в N-26, скасування сеансу без причини в N-29, N-30.

## Що на mock перевірити неможливо

Mock підтверджує лише форму контракту (коди, схеми, приклади). Поведінку зі станом перевіряють тільки на реальному сервері:
1. паралельні запити на одне місце, з 10 запитів рівно 1 успіх і 9 конфліктів (REQ-F-009, REQ-NF-006);
2. «все або нічого», після відмови місця 5 і 6 лишаються вільними (REQ-F-010, REQ-NF-001);
3. звільнення місць у схемі залу одразу після скасування (REQ-F-013);
4. повторне скасування не змінює стан (REQ-F-014);
5. новий сеанс з'являється в афіші (REQ-F-015);
6. каскадне скасування всіх бронювань сеансу (REQ-F-019);
7. ігнорування поля `role` при реєстрації (REQ-NF-005);
8. межа часу скасування, за 1 секунду до початку успіх, у момент початку відмова (REQ-F-012, REQ-TDD-003).
