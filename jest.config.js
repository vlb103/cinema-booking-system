module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/openapi.js'],
  // REQ-LOG-005: кожен прогін зберігає окремий звіт у logs/test-runs
  reporters: [
    'default',
    ['<rootDir>/tests/reporters/run-report-reporter.js', { outputDir: 'logs/test-runs' }],
  ],
};
