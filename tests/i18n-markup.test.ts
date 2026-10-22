import { expect, it } from 'vitest';
import { parseFragment } from '../src/core/markup';
it('localizes only generated reference labels in formatting fallbacks, retaining literal source text and filenames', () => {
  const source =
    '<b>x</b>'.repeat(21_000) +
    '<p>Image reference: original user text</p><img src="图 片.png"><audio src="sound.mp3"></audio>';
  const fallback = parseFragment(
    source,
    (kind, reference) => `${kind === 'image' ? '图片引用' : '音频引用'}：${reference}`,
  );
  expect(fallback.limited).toBe(true);
  expect(fallback.nodes[0]).toEqual({
    type: 'text',
    value: expect.stringContaining('图片引用：图 片.png'),
  });
  expect(fallback.nodes[0]).toEqual({
    type: 'text',
    value: expect.stringContaining('Image reference: original user text'),
  });
  expect(fallback.nodes[0]).toEqual({
    type: 'text',
    value: expect.stringContaining('音频引用：sound.mp3'),
  });
  expect(parseFragment(source).nodes[0]).toEqual({
    type: 'text',
    value: expect.stringContaining('Image reference: 图 片.png'),
  });
});
