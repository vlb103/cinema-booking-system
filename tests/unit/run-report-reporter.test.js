// Звіти прогонів тестів (tests/reporters/run-report-reporter.js).
// Джерела: SRS REQ-LOG-005, REQ-TDD-002 (видно стадії Red і Green), REQ-TDD-005, тікети T-66, T-81.
// Репортер є частиною тестової інфраструктури, його зроблено разом з каркасом,
// щоб уже перший прогін Red зберігся окремим звітом.
const fs = require('fs');
const os = require('os');
const path = require('path');
const RunReportReporter = require('../reporters/run-report-reporter');

function fakeResults() {
  return {
    numTotalTestSuites: 1,
    numTotalTests: 2,
    testResults: [{
      testFilePath: path.join(os.tmpdir(), 'tests', 'x.test.js'),
      testResults: [
        { ancestorTitles: ['suite'], title: '[REQ-F-001] passes', status: 'passed', duration: 5, failureMessages: [] },
        { ancestorTitles: ['suite'], title: '[REQ-F-003][ADD-05] fails', status: 'failed', duration: 7, failureMessages: ['\u001b[31mError: expected 201, got 404\u001b[39m\n    at x.test.js:1:1'] },
      ],
    }],
  };
}

function runReporter(outputDir, stage) {
  const reporter = new RunReportReporter({ rootDir: os.tmpdir() }, { outputDir, stage });
  reporter.silent = true;
  reporter.onRunStart();
  return reporter.onRunComplete(new Set(), fakeResults());
}

describe('Звіт прогону тестів (REQ-LOG-005)', () => {
  test('[REQ-LOG-005][T-66] після прогону створюються файли звіту JSON і Markdown', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbs-report-'));

    const { jsonPath, mdPath } = runReporter(outputDir, 'red');

    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(mdPath)).toBe(true);
  });

  test('[REQ-LOG-005][T-66] звіт містить час запуску, кількість тестів, списки успішних і впалих кейсів і повідомлення про помилки', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbs-report-'));

    const { jsonPath } = runReporter(outputDir, 'red');
    const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    expect(new Date(report.startedAt).toISOString()).toBe(report.startedAt);
    expect(report.totals).toMatchObject({ tests: 2, passed: 1, failed: 1 });
    expect(report.passed.map((t) => t.title)).toEqual(['suite > [REQ-F-001] passes']);
    expect(report.failed[0].title).toBe('suite > [REQ-F-003][ADD-05] fails');
    expect(report.failed[0].reason).toBe('Error: expected 201, got 404');
    expect(report.failed[0].failureMessages[0]).not.toMatch(/\u001b\[/);
  });

  test('[REQ-LOG-005][REQ-TDD-002] звіт фіксує стадію TDD і покриття вимог за ID у назвах тестів', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbs-report-'));

    const { jsonPath, mdPath } = runReporter(outputDir, 'red');
    const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    expect(report.stage).toBe('red');
    expect(path.basename(jsonPath)).toContain('_red');
    expect(report.requirements['REQ-F-003']).toEqual({ total: 1, passed: 0, failed: 1 });
    expect(report.requirements['ADD-05']).toEqual({ total: 1, passed: 0, failed: 1 });
    expect(fs.readFileSync(mdPath, 'utf8')).toContain('| REQ-F-001 | 1 | 1 | 0 |');
  });

  test('[REQ-LOG-005][T-66] кожен прогін зберігається окремим файлом і не перезаписує попередній', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbs-report-'));

    const first = runReporter(outputDir, 'red');
    const second = runReporter(outputDir, 'red');

    expect(second.jsonPath).not.toBe(first.jsonPath);
    expect(fs.readdirSync(outputDir).filter((f) => f.endsWith('.json'))).toHaveLength(2);
  });
});
