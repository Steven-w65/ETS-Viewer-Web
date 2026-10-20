import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Reader } from '../src/components/Reader';
import { Navigation } from '../src/components/Navigation';
import { ImportScreen } from '../src/components/ImportScreen';
import { RichText } from '../src/components/RichText';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseDocument } from '../src/core/parser';
import { ImageResources } from '../src/core/images';
import { choice, dialogue } from './fixtures';
const q = parseDocument(dialogue, 'bank/paper/content_1/content.json');
const resources = new ImageResources(new Map());
describe('answer-first reading', () => {
  it('keeps key points and group explanation independently collapsed with the first answer visible', async () => {
    const picture = parseDocument(
      {
        structure_type: 'collector.picture',
        info: {
          stid: 'picture',
          value: 'Describe the scene.',
          keypoint: 'Original key points',
          analyze: 'Original group explanation',
          std: [{ value: 'First stored answer' }],
        },
      },
      'bank/picture/content.json',
    );
    const view = render(<Reader key="picture" question={picture} resources={resources} />);
    const points = screen.getByRole('button', { name: 'Key Points' });
    const explanation = screen.getByRole('button', { name: 'Explanation' });
    expect(points).toHaveAttribute('aria-expanded', 'false');
    expect(explanation).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Original key points')).not.toBeInTheDocument();
    expect(screen.queryByText('Original group explanation')).not.toBeInTheDocument();
    expect(screen.getByText('First stored answer')).toBeVisible();
    fireEvent.click(points);
    expect(screen.getByText('Original key points')).toBeVisible();
    expect(explanation).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(explanation);
    expect(screen.getByText('Original group explanation')).toBeVisible();
    fireEvent.click(points);
    await waitFor(() => expect(screen.queryByText('Original key points')).not.toBeInTheDocument());
    expect(screen.getByText('Original group explanation')).toBeVisible();
    view.rerender(<Reader key="other-picture" question={picture} resources={resources} />);
    expect(screen.getByRole('button', { name: 'Explanation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
  it('collapses sub-question explanations using the same independent controls', () => {
    const question = structuredClone(q);
    question.parts[0].explanation = 'Original part explanation';
    render(<Reader question={question} resources={resources} />);
    const explanation = screen.getByRole('button', { name: 'Explanation' });
    expect(explanation).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Original part explanation')).not.toBeInTheDocument();
    fireEvent.click(explanation);
    expect(screen.getByText('Original part explanation')).toBeVisible();
    expect(screen.getAllByRole('button', { name: /^Question / })[0]).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
  it('keeps excessive imported formatting readable without exceeding React argument limits', () => {
    const value = '<div>' + '<b>x</b>'.repeat(150_000) + '</div>';
    const html = renderToStaticMarkup(
      <RichText value={value} source={q.source} resources={resources} />,
    );
    expect(html).toContain('Formatting limit reached');
    expect(html).toContain('x'.repeat(150_000));
  });
  it('aligns source speaker labels and keeps inline emphasis and meaningful line breaks', () => {
    const { container } = render(
      <RichText
        dialogue
        value={'<p><b>M:</b> First <em>line</em>.<br>Continued text.</p><p>W：Second line.</p>'}
        source={q.source}
        resources={resources}
      />,
    );
    expect(container.querySelectorAll('.speaker-label')).toHaveLength(2);
    expect(container.querySelector('em')).toHaveTextContent('line');
    expect(screen.getByText('Continued text.')).toBeVisible();
  });
  it('shows first answers while question/shared/additional cards start independently collapsed', () => {
    render(<Reader question={q} resources={resources} />);
    expect(screen.getByText('Explicit')).toBeVisible();
    expect(screen.queryByText('First standard')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Shared Material/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    const questions = screen.getAllByRole('button', { name: /^Question / });
    expect(questions).toHaveLength(2);
    questions.forEach((b) => expect(b).toHaveAttribute('aria-expanded', 'false'));
    fireEvent.click(questions[0]);
    expect(questions[0]).toHaveAttribute('aria-expanded', 'true');
    expect(questions[1]).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: /Additional Reference Answers/ }));
    expect(screen.getByText('First standard')).toBeVisible();
    expect(screen.getByText('Other reference')).toBeVisible();
  });
  it('Qn navigation scrolls to a part while keeping every answer present', () => {
    render(<Reader question={q} resources={resources} />);
    fireEvent.click(screen.getByRole('button', { name: 'Q2' }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByText('Explicit')).toBeVisible();
    expect(screen.getByText('Second primary')).toBeVisible();
  });
  it('renders missing answers neutrally without guessing or marking options', () => {
    render(
      <Reader question={parseDocument(choice, 'bank/p/content.json')} resources={resources} />,
    );
    expect(screen.getByText('Answer not found')).toBeVisible();
    expect(screen.getByText('B')).toBeVisible();
  });
  it('resets expanded cards when groups change but preserves them on a normal rerender', () => {
    const view = render(<Reader key={q.source} question={q} resources={resources} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Question / })[0]);
    view.rerender(<Reader key={q.source} question={q} resources={resources} />);
    expect(screen.getAllByRole('button', { name: /^Question / })[0]).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    view.rerender(<Reader key="other" question={q} resources={resources} />);
    expect(screen.getAllByRole('button', { name: /^Question / })[0]).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
describe('bounded group navigation and folder capability', () => {
  it('disables first/last boundaries and moves only to adjacent groups', () => {
    const onChange = vi.fn();
    const v = render(<Navigation index={0} total={3} onChange={onChange} />);
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(onChange).toHaveBeenCalledWith(1);
    v.rerender(<Navigation index={2} total={3} onChange={onChange} />);
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
    expect(screen.getByText('3 / 3')).toBeVisible();
  });
  it('always offers both imports and configures a directory input, with a ZIP fallback explanation', () => {
    const { container } = render(
      <ImportScreen
        onFolder={vi.fn()}
        onZip={vi.fn()}
        error="This browser did not return folder-relative paths. Use Import ZIP."
      />,
    );
    expect(screen.getByRole('button', { name: 'Select Folder' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Import ZIP' })).toBeVisible();
    expect(container.querySelector('input[webkitdirectory]')).toHaveAttribute('multiple');
    expect(screen.getByRole('alert')).toHaveTextContent('Use Import ZIP');
  });
});
