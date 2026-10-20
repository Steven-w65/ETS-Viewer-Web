import { createElement, useMemo, type ReactNode } from 'react';
import { LocalMedia } from './LocalMedia';
import { parseFragment, type FragmentNode } from '../core/markup';
import type { ImageResources } from '../core/images';
export interface RichProps {
  value: string;
  source: string;
  resources: ImageResources;
  dialogue?: boolean;
}
export function LocalImage({
  reference,
  source,
  resources,
}: {
  reference: string;
  source: string;
  resources: ImageResources;
}) {
  return (
    <LocalMedia reference={reference} source={source} resources={resources} fallbackKind="image" />
  );
}
const nodeText = (node: FragmentNode): string =>
  node.type === 'text'
    ? node.value
    : node.type === 'element'
      ? node.children.map(nodeText).join('')
      : '';
function withoutPrefix(nodes: FragmentNode[], count: number): FragmentNode[] {
  return nodes.flatMap((node) => {
    if (!count) return [node];
    if (node.type === 'text') {
      const removed = Math.min(count, node.value.length);
      count -= removed;
      return node.value.length > removed ? [{ ...node, value: node.value.slice(removed) }] : [];
    }
    if (node.type === 'element') {
      const size = nodeText(node).length,
        removed = Math.min(size, count);
      const children = withoutPrefix(node.children, removed);
      count -= removed;
      return children.length ? [{ ...node, children }] : [];
    }
    return [node];
  });
}
function dialogueLines(
  nodes: FragmentNode[],
  source: string,
  resources: ImageResources,
): ReactNode[] {
  const lines: FragmentNode[][] = [[]];
  for (const node of nodes) {
    if (node.type === 'element' && node.tag === 'br') {
      lines.push([]);
      continue;
    }
    if (node.type === 'text')
      node.value.split('\n').forEach((value, i) => {
        if (i) lines.push([]);
        lines.at(-1)!.push({ type: 'text', value });
      });
    else lines.at(-1)!.push(node);
  }
  return lines.map((line, i) => {
    const match = line
      .map(nodeText)
      .join('')
      .match(/^\s*((?:M|W|Man|Woman|Boy|Girl|A|B|Speaker \d+)[:：])\s*/i);
    if (match)
      return (
        <span className="dialogue-line" key={i}>
          <span className="speaker-label">{match[1]}</span>
          <span>{nodesToReact(withoutPrefix(line, match[0].length), source, resources)}</span>
        </span>
      );
    return (
      <span className="dialogue-prose" key={i}>
        {nodesToReact(line, source, resources)}
        {line.length === 0 && <br />}
      </span>
    );
  });
}
function nodesToReact(
  nodes: FragmentNode[],
  source: string,
  resources: ImageResources,
  dialogue = false,
): ReactNode[] {
  return nodes.map((node, i) => {
    if (node.type === 'text') return node.value;
    if (node.type === 'image')
      return (
        <LocalMedia
          key={i}
          reference={node.reference}
          source={source}
          resources={resources}
          fallbackKind="image"
        />
      );
    if (node.type === 'media')
      return (
        <LocalMedia
          key={i}
          reference={node.references[0] || ''}
          alternatives={node.references.slice(1)}
          fallbackKind={node.kind}
          source={source}
          resources={resources}
        />
      );
    const attrs: { key: number; colSpan?: number; rowSpan?: number } = { key: i };
    if (node.attrs.colspan) attrs.colSpan = node.attrs.colspan;
    if (node.attrs.rowspan) attrs.rowSpan = node.attrs.rowspan;
    const children =
      dialogue && ['p', 'div'].includes(node.tag)
        ? dialogueLines(node.children, source, resources)
        : nodesToReact(node.children, source, resources, dialogue);
    return children.length
      ? createElement(node.tag, attrs, children)
      : createElement(node.tag, attrs);
  });
}
export function RichText({ value, source, resources, dialogue = false }: RichProps) {
  const { content, limited } = useMemo(() => {
    const { nodes, limited } = parseFragment(value);
    const content =
      dialogue &&
      !limited &&
      nodes.every(
        (n) =>
          n.type !== 'element' || !['p', 'div', 'table', 'blockquote', 'ul', 'ol'].includes(n.tag),
      )
        ? dialogueLines(nodes, source, resources)
        : nodesToReact(nodes, source, resources, dialogue && !limited);
    return { content, limited };
  }, [value, source, resources, dialogue]);
  return (
    <div className="rich-text">
      {limited && (
        <p className="formatting-note" role="status">
          Formatting limit reached. Showing the original text with image references.
        </p>
      )}
      {content}
    </div>
  );
}
