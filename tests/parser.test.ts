import { describe, expect, it } from 'vitest';
import { parseDocument, metadataAnswerMap } from '../src/core/parser';
import { formatAnswers, exportFilename, exportBytes } from '../src/core/exporter';
import { choice, dialogue, metadata } from './fixtures';
const source = 'bank/paper/content_synthetic/content.json';
describe('desktop parser parity', () => {
  it('joins metadata by both IDs without overriding explicit answers or mutating input', () => {
    const original = structuredClone(choice);
    const q = parseDocument(choice, source, metadata);
    expect(q.id).toBe('synthetic');
    expect(q.parts.map((p) => p.answers[0]?.text)).toEqual(['B', 'A']);
    expect(q.parts[0].prompt).toBe('Choose the river.');
    expect(q.parts[0].options).toEqual([
      { label: 'A', text: 'A hill' },
      { label: 'B', text: 'A river' },
    ]);
    expect(parseDocument(choice, source).parts[1].answers).toEqual([]);
    expect(choice).toEqual(original);
  });
  it('preserves explicit/std/ref ordering and source fields', () => {
    const p = parseDocument(dialogue, source).parts[0];
    expect(p.answers.map((a) => a.text)).toEqual([
      'Explicit',
      'First standard',
      'Other reference</br>',
    ]);
    expect(p.answers[1].field).toBe('info.question[0].std[0].value');
  });
  it.each(['collector.word', 'collector.read'])(
    'never treats %s prompts/evaluator/answer fields as answers',
    (kind) => {
      const q = parseDocument(
        {
          structure_type: kind,
          info: {
            stid: 'r',
            value: 'Passage',
            translate: '原文翻译',
            ai: 'Evaluator',
            answer: 'Not reference',
          },
        },
        source,
      );
      expect(q.parts[0].answers).toEqual([]);
      expect(q.parts[0].translation).toBe('原文翻译');
    },
  );
  it('preserves picture topic, image, keypoints and explanation', () => {
    const q = parseDocument(
      {
        structure_type: 'collector.picture',
        info: {
          stid: 123,
          topic: 'Shared umbrellas.',
          value: 'Tell a story.',
          image: 'content.jpg',
          keypoint: 'QR code',
          analyze: '<p>Rain.</p>',
          std: [{ value: 'First' }, { value: 'Second' }],
        },
      },
      source,
    );
    expect(q.id).toBe('123');
    expect(q.topic).toBe('Shared umbrellas.');
    expect(q.images).toEqual(['content.jpg']);
    expect(q.keyPoints).toBe('QR code');
    expect(q.parts[0].number).toBe('');
    expect(q.parts[0].answers).toHaveLength(2);
  });
  it('supports the real metadata wrapper', () => {
    const wrapper = [
      { code_id: 'content_choose', code_json_obj: JSON.stringify(choice.info) },
      ...metadata,
    ];
    expect(parseDocument(wrapper, source).parts[1].answers[0].text).toBe('A');
  });
  it('rejects conflicting metadata and malformed or unsupported records', () => {
    expect(() =>
      metadataAnswerMap([
        ...metadata,
        { code_id: 'answer', code_json_array: '[{"stid":"synthetic","xth":"2","answer":"B"}]' },
      ]),
    ).toThrow(/Conflicting/);
    for (const data of [
      null,
      {},
      { structure_type: 'collector.unknown' },
      { ...choice, info: { ...choice.info, stid: false } },
      {
        ...choice,
        info: {
          stid: 'x',
          xtlist: [
            { xt_xh: '1', xt_nr: 'one' },
            { xt_xh: '1', xt_nr: 'two' },
          ],
        },
      },
    ])
      expect(() => parseDocument(data, source)).toThrow();
  });
});
describe('full paper export', () => {
  it('exports every group and part with only first answers and desktop separators', () => {
    const text = formatAnswers('试卷', [
      parseDocument(choice, source),
      parseDocument(dialogue, source),
    ]);
    expect(text.startsWith('ETS-Viewer answer export\nTask: 试卷\n')).toBe(true);
    expect(text.match(/\nAnswer:\n/g)).toHaveLength(4);
    expect(text).toContain('A. A hill\nB. A river');
    expect(text).toContain('Answer not found');
    expect(text).toContain('Explicit');
    expect(text).not.toContain('Other reference');
    expect(text).toContain('='.repeat(72));
    expect(Array.from(exportBytes('试卷', [])).slice(0, 3)).toEqual([239, 187, 191]);
  });
  it.each([
    ['CON', '_CON.txt'],
    ['com1.paper', '_com1.paper.txt'],
    ['LPT²', '_LPT².txt'],
    ['... ', 'ETS-answers.txt'],
    ['试卷 2026', '试卷 2026.txt'],
  ])('uses desktop filename rules for %s', (name, expected) =>
    expect(exportFilename(name)).toBe(expected),
  );
});
