import { expect, it } from 'vitest';
import { parseDocument } from '../../src/core/parser';
const source = 'bank/p/content_picture/content.json';
it('preserves picture source content and key points outside answers', () => {
  const q = parseDocument(
    {
      structure_type: 'collector.picture',
      info: {
        stid: 'g',
        topic: 'Topic',
        value: '<p>Original passage</p>',
        image: 'material/a.jpg',
        keypoint: 'Original key points',
        std: [{ value: 'One' }, { value: 'Two' }],
      },
    },
    source,
  );
  expect(q.parts[0].prompt).toBe('<p>Original passage</p>');
  expect(q.keyPoints).toBe('Original key points');
  expect(q.parts[0].answers.map((a) => a.text)).toEqual(['One', 'Two']);
  expect(q.images).toEqual(['material/a.jpg']);
});
it('allows optional answers and rejects malformed or empty content', () => {
  expect(
    parseDocument(
      { structure_type: 'collector.picture', info: { stid: 'g', topic: 'Topic' } },
      source,
    ).parts[0].answers,
  ).toEqual([]);
  for (const info of [
    { stid: 'g' },
    { stid: 'g', value: false },
    { stid: 'g', value: 'Prompt', std: { bad: true } },
  ])
    expect(() => parseDocument({ structure_type: 'collector.picture', info }, source)).toThrow();
});
