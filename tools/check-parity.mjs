import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const desktop = path.resolve(process.argv[2] ?? '../ETS-Viewer');
const bank = path.resolve(
  process.argv[3] ?? process.env.ETS_TEST_BANK ?? path.join(process.env.APPDATA ?? '', 'ETS'),
);
const reference = spawnSync(
  process.env.PYTHON ?? 'python',
  ['-B', 'tools/python-reference.py', desktop, bank],
  { encoding: 'utf8', maxBuffer: 64 * 1024 ** 2 },
);
if (reference.status !== 0)
  throw new Error(
    reference.stderr || 'Python reference unavailable; provide desktop and bank paths.',
  );
const expected = JSON.parse(reference.stdout),
  files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) await walk(name);
    else
      files.push({
        path: path.basename(bank) + '/' + path.relative(bank, name).split(path.sep).join('/'),
        blob: new Blob([await readFile(name)]),
      });
  }
}
await walk(bank);
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { scanBank } = await server.ssrLoadModule('/src/core/scanner/index.ts');
  const { formatAnswers } = await server.ssrLoadModule('/src/core/exporter/index.ts');
  const result = await scanBank(files, path.basename(bank));
  const actual = result.papers.flatMap((p) => p.questions);
  assert.equal(
    actual.length,
    expected.questions.length,
    'Copy reconciliation must retain the legacy group count',
  );
  const project = (value, shape) =>
    Array.isArray(shape)
      ? shape.map((item, i) => project(value[i], item))
      : shape && typeof shape === 'object'
        ? Object.fromEntries(
            Object.entries(shape).map(([key, item]) => [key, project(value[key], item)]),
          )
        : value;
  let promotedPrompts = 0;
  const legacy = actual.map((question, i) => {
    const original = expected.questions[i];
    assert.equal(
      question.parts.length,
      original.parts.length,
      'Preserve all original sub-questions',
    );
    const projected = project(question, original);
    for (const [j, part] of question.parts.entries()) {
      const previous = original.parts[j];
      // A verified compatibility improvement moves an xt_value-only prompt out
      // of the transcript slot. Assert its exact source text before projecting
      // the legacy representation for the desktop regression comparison.
      if (
        question.kind === 'collector.choose' &&
        part.promptField === 'xt_value' &&
        !previous.prompt &&
        part.prompt === previous.context &&
        !part.context
      ) {
        projected.parts[j].prompt = previous.prompt;
        projected.parts[j].context = previous.context;
        promotedPrompts++;
      }
    }
    return projected;
  });
  assert.deepEqual(
    legacy,
    expected.questions,
    'All fields and original question ordering must match Python',
  );
  for (const paper of result.papers)
    assert.equal(
      formatAnswers(
        paper.id,
        legacy.filter((q) => paper.questions.some((p) => p.source === q.source)),
      ),
      expected.exports[paper.key],
      'Legacy representation must preserve the desktop export format',
    );
  console.log(
    JSON.stringify(
      {
        parity: 'PASS',
        papers: result.papers.length,
        groups: actual.length,
        parts: actual.reduce((n, q) => n + q.parts.length, 0),
        storedAnswers: actual.reduce(
          (n, q) => n + q.parts.reduce((m, p) => m + p.answers.length, 0),
          0,
        ),
        filesScanned: result.filesScanned,
        legacyExportsMatched: result.papers.length,
        verifiedXtValuePromotions: promotedPrompts,
        pythonIssues: expected.issues,
        webIssues: result.issues.length,
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
