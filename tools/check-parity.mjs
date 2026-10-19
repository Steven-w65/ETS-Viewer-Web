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
  assert.deepEqual(
    JSON.parse(JSON.stringify(actual)),
    expected.questions,
    'All fields and original question ordering must match Python',
  );
  for (const paper of result.papers)
    assert.equal(
      formatAnswers(paper.id, paper.questions),
      expected.exports[paper.key],
      'Full-paper export must match Python exactly',
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
        exportsMatched: result.papers.length,
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
