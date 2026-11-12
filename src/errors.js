// Помилки застосунку. ApiError перетворюється на відповідь у моделі Error з openapi.yaml (ADD-03).
class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = { ApiError };
