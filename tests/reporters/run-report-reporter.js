// Репортер Jest, який після кожного прогону зберігає окремий звіт (REQ-LOG-005, T-66, T-67, T-81).
// Звіт містить час запуску, кількість тестів, списки успішних і впалих кейсів, повідомлення про помилки.
// Стадію TDD (red, green, refactor) можна передати змінною середовища TDD_STAGE.
const fs = require('fs');
const path = require('path');

const ANSI = /\u001b\[[0-9;]*m/g;
const REQ_ID = /\b(REQ-[A-Z]+-\d{3}|ADD-\d{2})\b/g;

function stamp(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function escapeCell(text) {
  return text.replace(/\|/g, '\\|');
}

function firstLine(msg) {
  return msg.split('\n').map((l) => l.trim()).find((l) => l.length > 0) || '';
}

class RunReportReporter {
  constructor(globalConfig, options = {}) {
    this.rootDir = (globalConfig && globalConfig.rootDir) || process.cwd();
    this.outputDir = path.resolve(this.rootDir, options.outputDir || 'logs/test-runs');
    this.stage = options.stage || process.env.TDD_STAGE || 'run';
    this.startedAt = new Date();
  }

  onRunStart() {
    this.startedAt = new Date();
  }

  buildReport(results) {
    const finishedAt = new Date();
    const tests = [];
    for (const file of results.testResults || []) {
      const relFile = path.relative(this.rootDir, file.testFilePath || '').split(path.sep).join('/');
      if (file.testExecError) {
        tests.push({
          file: relFile, title: '(помилка завантаження файлу)', status: 'failed', reqIds: [],
          failureMessages: [String(file.testExecError.message || file.testExecError).replace(ANSI, '')],
        });
      }
      for (const t of file.testResults || []) {
        const title = [...(t.ancestorTitles || []), t.title].join(' > ');
        tests.push({
          file: relFile,
          title,
          status: t.status,
          durationMs: t.duration || 0,
          reqIds: [...new Set(title.match(REQ_ID) || [])],
          failureMessages: (t.failureMessages || []).map((m) => m.replace(ANSI, '')),
        });
      }
    }
    const passed = tests.filter((t) => t.status === 'passed');
    const failed = tests.filter((t) => t.status === 'failed');

    const requirements = {};
    for (const t of tests) {
      for (const id of t.reqIds) {
        requirements[id] = requirements[id] || { total: 0, passed: 0, failed: 0 };
        requirements[id].total += 1;
        if (t.status === 'passed') requirements[id].passed += 1;
        if (t.status === 'failed') requirements[id].failed += 1;
      }
    }

    return {
      stage: this.stage,
      startedAt: this.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt - this.startedAt,
      success: failed.length === 0 && !results.numRuntimeErrorTestSuites,
      totals: {
        suites: results.numTotalTestSuites || 0,
        tests: results.numTotalTests != null ? results.numTotalTests : tests.length,
        passed: passed.length,
        failed: failed.length,
        skipped: tests.length - passed.length - failed.length,
      },
      requirements,
      passed: passed.map((t) => ({ file: t.file, title: t.title })),
      failed: failed.map((t) => ({ file: t.file, title: t.title, reason: firstLine(t.failureMessages[0] || ''), failureMessages: t.failureMessages })),
      tests,
    };
  }

  toMarkdown(r) {
    const lines = [];
    lines.push(`# Звіт прогону тестів (${r.stage})`, '');
    lines.push(`Час запуску ${r.startedAt}, завершення ${r.finishedAt}, тривалість ${r.durationMs} мс.`, '');
    lines.push('| Наборів | Тестів | Успішно | Впало | Пропущено |', '| :---: | :---: | :---: | :---: | :---: |');
    lines.push(`| ${r.totals.suites} | ${r.totals.tests} | ${r.totals.passed} | ${r.totals.failed} | ${r.totals.skipped} |`, '');
    lines.push('## Покриття вимог', '', '| Вимога | Тестів | Успішно | Впало |', '| :--- | :---: | :---: | :---: |');
    for (const id of Object.keys(r.requirements).sort()) {
      const q = r.requirements[id];
      lines.push(`| ${id} | ${q.total} | ${q.passed} | ${q.failed} |`);
    }
    lines.push('', '## Тести', '', '| Файл | Тест | Статус | Причина падіння |', '| :--- | :--- | :---: | :--- |');
    for (const t of r.tests) {
      const reason = t.status === 'failed' ? escapeCell(firstLine(t.failureMessages[0] || '')) : '';
      lines.push(`| ${t.file} | ${escapeCell(t.title)} | ${t.status} | ${reason} |`);
    }
    if (r.failed.length) {
      lines.push('', '## Повідомлення про помилки', '');
      for (const t of r.failed) {
        lines.push(`### ${t.title}`, '', '```', (t.failureMessages[0] || '').split('\n').slice(0, 25).join('\n'), '```', '');
      }
    }
    return lines.join('\n') + '\n';
  }

  uniqueBase() {
    const base = `${stamp(this.startedAt)}_${this.stage}`;
    let name = base;
    let i = 1;
    while (fs.existsSync(path.join(this.outputDir, `${name}.json`))) {
      name = `${base}_${i++}`;
    }
    return name;
  }

  onRunComplete(_contexts, results) {
    const report = this.buildReport(results);
    fs.mkdirSync(this.outputDir, { recursive: true });
    const base = this.uniqueBase();
    const jsonPath = path.join(this.outputDir, `${base}.json`);
    const mdPath = path.join(this.outputDir, `${base}.md`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(mdPath, this.toMarkdown(report), 'utf8');
    this.lastReportPaths = { jsonPath, mdPath };
    if (!this.silent) {
      process.stdout.write(`\nЗвіт прогону збережено: ${path.relative(this.rootDir, mdPath)}\n`);
    }
    return this.lastReportPaths;
  }
}

module.exports = RunReportReporter;
