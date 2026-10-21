import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Reader } from '../src/components/Reader';
import { ImageResources } from '../src/core/images';
import { parseDocument } from '../src/core/parser';
import { formatAnswers } from '../src/core/exporter';
const resources = new ImageResources(new Map());
it('renders normalized image choices, shared material and keywords in collapsed source cards', async () => {
  const q = parseDocument(
    {
      structure_type: 'collector.choose',
      info: {
        stid: 'g',
        st_nr: 'Shared passage',
        value: 'Shared transcript',
        xtlist: [
          {
            xt_xh: '15',
            xt_nr: 'Choose',
            xxlist: [{ xx_mc: 'A', xx_wj: 'option.png' }],
            answer: 'B',
          },
        ],
      },
    },
    'bank/p/content_1/content.json',
  );
  render(<Reader question={q} resources={resources} />);
  expect(screen.getByText('B')).toBeVisible();
  expect(screen.queryByText('Shared transcript')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Shared Material/ }));
  expect(screen.getByText('Shared transcript')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /^Question / }));
  expect(await screen.findByText('Image unavailable: option.png')).toBeVisible();
});
it('keeps keywords with their source question and preserves first/additional answer order', () => {
  const q = parseDocument(
    {
      structure_type: 'collector.3q5a',
      info: {
        question: [
          {
            ask: 'Prompt',
            keywords: 'Source hints',
            std: [{ value: 'First' }, { value: 'Second' }],
          },
        ],
      },
    },
    'bank/resource/r/content.json',
  );
  render(<Reader question={q} resources={resources} />);
  expect(screen.getByText('First')).toBeVisible();
  expect(screen.queryByText('Source hints')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Question / }));
  expect(screen.getByText('Source hints')).toBeVisible();
  expect(screen.queryByText('Second')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Additional Reference Answers/ }));
  expect(screen.getByText('Second')).toBeVisible();
});
it('exports all eight normalized types with official blank numbers and image option references', () => {
  const types = ['choose', 'role', '3q5a', 'fill', 'dialogue', 'picture', 'read', 'word'];
  const questions = types.map((type, i) =>
    parseDocument(
      {
        structure_type: 'collector.' + type,
        info: {
          stid: String(i),
          value: 'Original',
          xtlist: [
            {
              xt_xh: '15',
              xt_nr: 'Choose',
              xxlist: [{ xx_mc: 'A', xx_wj: 'option.png' }],
              answer: 'Choice',
            },
          ],
          question: [{ ask: 'Prompt', std: [{ value: 'First' }, { value: 'Other' }] }],
          std: [{ th: '16', value: 'A/B' }],
        },
      },
      `bank/p/content_${i}/content.json`,
    ),
  );
  const text = formatAnswers('Paper', questions);
  expect(text.match(/Question group:/g)).toHaveLength(8);
  expect(text).toContain('A. [Image: option.png]');
  expect(text).toContain('Question: 3/16');
  expect(text).toContain('A/B');
  expect(text).not.toContain('Other');
  expect(text.match(/Answer not found/g)).toHaveLength(2);
});
it('keeps exiting content inaccessible, then removes it after the collapse transition', async () => {
  const q = parseDocument(
    {
      structure_type: 'collector.picture',
      info: { value: 'Prompt', keypoint: 'Source key points' },
    },
    'bank/p/content.json',
  );
  render(<Reader question={q} resources={resources} />);
  const toggle = screen.getByRole('button', { name: 'Key Points' });
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  expect(screen.getByText('Source key points').closest('[aria-hidden]')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  await waitFor(() => expect(screen.queryByText('Source key points')).not.toBeInTheDocument());
});
it('removes collapsed content immediately when reduced motion is requested', () => {
  const preference = vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  const q = parseDocument(
    { structure_type: 'collector.picture', info: { value: 'Prompt', keypoint: 'Reduced points' } },
    'bank/p/content.json',
  );
  render(<Reader question={q} resources={resources} />);
  const toggle = screen.getByRole('button', { name: 'Key Points' });
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  expect(screen.queryByText('Reduced points')).not.toBeInTheDocument();
  preference.mockRestore();
});
