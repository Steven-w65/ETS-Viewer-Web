import { expect, it } from 'vitest';
import { parseDocument, parseDocumentResult } from '../../src/core/parser';
import { parserRegistry, registerParser } from '../../src/core/parser/registry';
it('dispatches all eight collector types through registered parsers', () => {
  expect([...parserRegistry.keys()].sort()).toEqual([
    'collector.3q5a',
    'collector.choose',
    'collector.dialogue',
    'collector.fill',
    'collector.picture',
    'collector.read',
    'collector.role',
    'collector.word',
  ]);
});
it('reports unsupported types locally with structured diagnostics', () => {
  const r = parseDocumentResult(
    { structure_type: 'collector.future', info: { stid: 'g' } },
    'bank/p/content.json',
  );
  expect(r.question).toBeUndefined();
  expect(r.diagnostics[0]).toMatchObject({
    severity: 'error',
    code: 'unsupported_structure',
    path: 'bank/p/content.json',
    structureType: 'collector.future',
  });
});
it('allows a new parser to be registered without changing the entry point', () => {
  registerParser({
    type: 'collector.test',
    label: 'Test type',
    parse(info, context) {
      return {
        ...context.createQuestion(),
        parts: [context.createPart({ number: '1', prompt: String(info.value) })],
      };
    },
  });
  try {
    expect(
      parseDocument(
        { structure_type: 'collector.test', info: { stid: 'g', value: 'Original' } },
        'bank/content.json',
      ),
    ).toMatchObject({
      kind: 'collector.test',
      parts: [{ prompt: 'Original' }],
      typeLabel: 'Test type',
    });
  } finally {
    parserRegistry.delete('collector.test');
  }
});
