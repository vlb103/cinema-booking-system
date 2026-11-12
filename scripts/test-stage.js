// Запуск тестів з позначкою стадії TDD у звіті прогону: npm run test:red | test:green | test:refactor
const { spawnSync } = require('child_process');

const stage = process.argv[2] || 'run';
const jestBin = require.resolve('jest/bin/jest');
const result = spawnSync(process.execPath, [jestBin, ...process.argv.slice(3)], {
  stdio: 'inherit',
  env: { ...process.env, TDD_STAGE: stage },
});
process.exit(result.status === null ? 1 : result.status);
