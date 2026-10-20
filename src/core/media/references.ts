import type { Question, MediaReference } from '../../types';
import { safeFragment, type FragmentNode } from '../markup';
export function markupMedia(value: string, field: string): MediaReference[] {
  const refs: MediaReference[] = [];
  const walk = (nodes: FragmentNode[]) => {
    for (const node of nodes) {
      if (node.type === 'image') refs.push({ kind: 'image', reference: node.reference, field });
      else if (node.type === 'media')
        for (const reference of node.references) refs.push({ kind: node.kind, reference, field });
      else if (node.type === 'element') walk(node.children);
    }
  };
  walk(safeFragment(value));
  return refs;
}
/** All references retain their semantic owner; file discovery never invents references. */
export function questionMedia(q: Question): MediaReference[] {
  const refs: MediaReference[] = [...(q.media || [])];
  const addImages = (images: string[], field: string) =>
    refs.push(...images.map((reference) => ({ kind: 'image' as const, reference, field })));
  const text = (value: string, field: string) => refs.push(...markupMedia(value, field));
  addImages(q.images, 'images');
  for (const field of ['context', 'instructions', 'topic', 'explanation', 'keyPoints'] as const)
    text(q[field], field);
  for (const [i, m] of (q.sharedMaterials || []).entries()) {
    refs.push(...(m.media || []));
    addImages(m.images || [], `sharedMaterials[${i}].images`);
    text(m.text, `sharedMaterials[${i}].text`);
  }
  for (const [i, p] of q.parts.entries()) {
    const field = `parts[${i}]`;
    refs.push(...(p.media || []));
    addImages(p.images, field + '.images');
    for (const key of ['prompt', 'context', 'translation', 'explanation'] as const)
      text(p[key], field + '.' + key);
    for (const [j, o] of p.options.entries()) {
      addImages(o.images || [], `${field}.options[${j}].images`);
      text(o.text, `${field}.options[${j}].text`);
    }
    for (const [j, a] of p.answers.entries()) {
      refs.push(...(a.media || []));
      text(a.text, `${field}.answers[${j}].text`);
    }
    for (const [j, s] of (p.supplements || []).entries()) {
      refs.push(...(s.media || []));
      addImages(s.images || [], `${field}.supplements[${j}].images`);
      text(s.text, `${field}.supplements[${j}].text`);
    }
  }
  return refs;
}
