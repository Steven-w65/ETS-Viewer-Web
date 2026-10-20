import { Parser } from 'htmlparser2';

export type FragmentNode =
  | { type: 'text'; value: string }
  | { type: 'image'; reference: string }
  | { type: 'media'; kind: 'audio' | 'video'; references: string[] }
  | { type: 'element'; tag: string; attrs: Record<string, number>; children: FragmentNode[] };
const blocks = new Set(['br', 'p', 'div', 'li', 'tr']);
const tags = new Set([
  'p',
  'div',
  'br',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'sub',
  'sup',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'blockquote',
]);
const blocked = new Set(['script', 'style', 'iframe', 'object', 'head', 'template', 'svg', 'math']);
const legacyBreaks = (value: string) => value.replace(/<\/br\s*>/gi, '<br>');
/** Pure text parsing never constructs browser DOM or fetches embedded resources. */
export function plainText(value: string): string {
  const chunks: string[] = [];
  const parser = new Parser(
    {
      ontext: (t) => chunks.push(t),
      onopentag: (t) => {
        if (blocks.has(t)) chunks.push('\n');
      },
      onclosetag: (t) => {
        if (blocks.has(t)) chunks.push('\n');
      },
    },
    { decodeEntities: true },
  );
  parser.end(legacyBreaks(value));
  return chunks.join('').replace(/\s+/gu, ' ').trim();
}
const MAX_FRAGMENT_NODES = 20_000;
/** Allowlist AST with a plain-text fallback for excessive formatting complexity. */
export function parseFragment(value: string): { nodes: FragmentNode[]; limited: boolean } {
  const root: FragmentNode[] = [];
  const stack: { tag: string; nodes: FragmentNode[] }[] = [{ tag: '', nodes: root }];
  const fallback: string[] = [];
  const mediaStack: { tag: string; node: Extract<FragmentNode, { type: 'media' }> }[] = [];
  let suppressed = 0,
    count = 0,
    limited = false;
  const canAdd = () => {
    if (++count > MAX_FRAGMENT_NODES) limited = true;
    return !limited;
  };
  const parser = new Parser(
    {
      onopentag(tag, attrs) {
        if (blocked.has(tag)) {
          suppressed++;
          return;
        }
        if (suppressed) return;
        if (tag === 'audio' || tag === 'video') {
          if (mediaStack.length || !canAdd()) return;
          const node: Extract<FragmentNode, { type: 'media' }> = {
            type: 'media',
            kind: tag,
            references: attrs.src ? [attrs.src] : [],
          };
          stack.at(-1)!.nodes.push(node);
          mediaStack.push({ tag, node });
          if (attrs.src) fallback.push(`\n${tag} reference: ${attrs.src}\n`);
          return;
        }
        if (mediaStack.length) {
          if (tag === 'source' && attrs.src) {
            mediaStack.at(-1)!.node.references.push(attrs.src);
            fallback.push('\nMedia reference: ' + attrs.src + '\n');
          }
          return;
        }
        if (blocks.has(tag)) fallback.push('\n');
        if (tag === 'img' && attrs.src) fallback.push('\nImage reference: ' + attrs.src + '\n');
        if (limited) return;
        const current = stack[stack.length - 1].nodes;
        if (tag === 'img') {
          if (attrs.src && canAdd()) current.push({ type: 'image', reference: attrs.src });
          return;
        }
        if (!tags.has(tag)) return;
        if (stack.length >= 80) {
          limited = true;
          return;
        }
        if (!canAdd()) return;
        const safeAttrs: Record<string, number> = {};
        if (tag === 'td' || tag === 'th')
          for (const key of ['colspan', 'rowspan']) {
            if (/^\d+$/.test(attrs[key] ?? '') && +attrs[key] >= 1 && +attrs[key] <= 100)
              safeAttrs[key] = +attrs[key];
          }
        const node: FragmentNode = { type: 'element', tag, attrs: safeAttrs, children: [] };
        current.push(node);
        if (tag !== 'br') stack.push({ tag, nodes: node.children });
      },
      onclosetag(tag) {
        if (blocked.has(tag)) {
          suppressed = Math.max(0, suppressed - 1);
          return;
        }
        if (suppressed) return;
        if (mediaStack.length) {
          if (mediaStack.at(-1)!.tag === tag) mediaStack.pop();
          return;
        }
        if (blocks.has(tag)) fallback.push('\n');
        if (limited) return;
        for (let i = stack.length - 1; i > 0; i--)
          if (stack[i].tag === tag) {
            stack.length = i;
            break;
          }
      },
      ontext(text) {
        if (suppressed || mediaStack.length) return;
        fallback.push(text);
        if (canAdd()) stack[stack.length - 1].nodes.push({ type: 'text', value: text });
      },
    },
    { decodeEntities: true },
  );
  parser.end(legacyBreaks(value));
  return { nodes: limited ? [{ type: 'text', value: fallback.join('') }] : root, limited };
}
/** Imported HTML is never inserted into browser DOM as HTML. */
export const safeFragment = (value: string): FragmentNode[] => parseFragment(value).nodes;
export function imageReferences(value: string): string[] {
  const refs: string[] = [];
  function walk(nodes: FragmentNode[]) {
    for (const n of nodes) {
      if (n.type === 'image') refs.push(n.reference);
      else if (n.type === 'element') walk(n.children);
    }
  }
  walk(safeFragment(value));
  return refs;
}
