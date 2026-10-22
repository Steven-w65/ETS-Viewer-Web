import type { Issue, Question, SubQuestion, StoredAnswer } from '../../types';
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function promptsEquivalent(a: SubQuestion, b: SubQuestion): boolean {
  if (a.prompt === b.prompt) return true;
  if (
    !a.number ||
    a.number !== b.number ||
    a.numberOrigin === 'display' ||
    b.numberOrigin === 'display'
  )
    return false;
  const strip = (text: string) => text.replace(/^\d+[.、．]\s+/, '');
  // A single added display label is a verified copy convention. Never remove
  // different leading numbers from both source sentences to make them equal.
  return strip(a.prompt) === b.prompt || a.prompt === strip(b.prompt);
}
function semanticPart(p: SubQuestion) {
  return {
    number: p.number,
    numberOrigin: p.numberOrigin,
    officialNumber: p.officialNumber,
    prompt: p.prompt,
    context: p.context,
    options: p.options,
    answers: p.answers.map((a) => ({ text: a.text, media: a.media })),
    firstSourceAnswer: p.firstSourceAnswer && {
      text: p.firstSourceAnswer.text,
      media: p.firstSourceAnswer.media,
    },
    explanation: p.explanation,
    images: p.images,
    translation: p.translation,
    supplements: p.supplements,
    media: p.media,
  };
}
function equivalentParts(a: SubQuestion[], b: SubQuestion[]): boolean {
  if (a.length !== b.length) return false;
  const unique = new Set(a.map((p) => p.number)).size === a.length;
  return a.every(
    (p, i) =>
      (p.prompt === b[i].prompt || (unique && promptsEquivalent(p, b[i]))) &&
      same({ ...semanticPart(p), prompt: '' }, { ...semanticPart(b[i]), prompt: '' }),
  );
}
function equivalentQuestions(a: Question, b: Question): boolean {
  return (
    same({ ...semantic(a), parts: [] }, { ...semantic(b), parts: [] }) &&
    equivalentParts(a.parts, b.parts)
  );
}
function semantic(q: Question) {
  return {
    kind: q.kind,
    id: q.id,
    context: q.context,
    instructions: q.instructions,
    topic: q.topic,
    images: q.images,
    explanation: q.explanation,
    keyPoints: q.keyPoints,
    sharedMaterials: q.sharedMaterials,
    media: q.media,
    parts: q.parts.map(semanticPart),
  };
}
class Conflict extends Error {}
function value<T>(a: T, b: T): T {
  const empty = (v: T) => v == null || v === '' || (Array.isArray(v) && !v.length);
  if (empty(a)) return b;
  if (empty(b) || same(a, b)) return a;
  throw new Conflict();
}
function answers(a: StoredAnswer[], b: StoredAnswer[]) {
  if (!a.length) return b;
  if (!b.length) return a;
  // An ordered prefix may add reference variants, but never changes their order.
  const short = a.length <= b.length ? a : b,
    long = short === a ? b : a;
  if (!short.every((item, i) => item.text === long[i].text)) throw new Conflict();
  return long.map((answer, i) =>
    i < short.length ? { ...answer, media: value(answer.media, short[i].media) } : answer,
  );
}
function mergePart(a: SubQuestion, b: SubQuestion, kind: Question['kind']): SubQuestion {
  let left = a,
    right = b;
  if (kind === 'collector.choose') {
    if (
      a.promptField === 'xt_value' &&
      b.promptField === 'xt_nr' &&
      a.prompt === b.context &&
      !a.context
    )
      left = { ...a, prompt: '', promptField: 'xt_nr' };
    if (
      b.promptField === 'xt_value' &&
      a.promptField === 'xt_nr' &&
      b.prompt === a.context &&
      !b.context
    )
      right = { ...b, prompt: '', promptField: 'xt_nr' };
  }
  const merged = { ...left };
  merged.prompt = promptsEquivalent(left, right) ? left.prompt : value(left.prompt, right.prompt);
  for (const key of ['context', 'explanation', 'translation'] as const)
    merged[key] = value(left[key], right[key]);
  merged.officialNumber = value(left.officialNumber, right.officialNumber);
  merged.images = value(left.images, right.images);
  merged.supplements = value(left.supplements, right.supplements);
  merged.media = value(left.media, right.media);
  merged.answers = answers(left.answers, right.answers);
  const first = left.firstSourceAnswer,
    other = right.firstSourceAnswer;
  if (first && other && first.text !== other.text) throw new Conflict();
  if (first || other)
    merged.firstSourceAnswer =
      first && other ? { ...first, media: value(first.media, other.media) } : first || other;
  if (!left.options.length || !right.options.length)
    merged.options = value(left.options, right.options);
  else {
    const labels = left.options.map((o) => o.label),
      other = right.options.map((o) => o.label);
    if (!same(labels, other) || labels.some((l) => !l) || new Set(labels).size !== labels.length) {
      if (!same(left.options, right.options)) throw new Conflict();
    } else
      merged.options = left.options.map((o, i) => ({
        ...o,
        text: value(o.text, right.options[i].text),
        ...(o.images || right.options[i].images
          ? { images: value(o.images, right.options[i].images) }
          : {}),
      }));
  }
  return merged;
}
function merge(a: Question, b: Question): Question {
  if (a.identity?.origin !== 'source' || b.identity?.origin !== 'source') throw new Conflict();
  const q = { ...a };
  for (const key of ['context', 'instructions', 'topic', 'explanation', 'keyPoints'] as const)
    q[key] = value(a[key], b[key]);
  q.images = value(a.images, b.images);
  q.sharedMaterials = value(a.sharedMaterials, b.sharedMaterials);
  q.media = value(a.media, b.media);
  if (equivalentParts(a.parts, b.parts)) return q;
  const unique = (parts: SubQuestion[]) =>
    parts.every((p) => !!p.number && p.numberOrigin !== 'display') &&
    new Set(parts.map((p) => p.number)).size === parts.length;
  if (!unique(a.parts) || !unique(b.parts)) throw new Conflict();
  const byNumber = new Map(b.parts.map((p) => [p.number, p]));
  q.parts = a.parts.map((p) =>
    byNumber.has(p.number) ? mergePart(p, byNumber.get(p.number)!, a.kind) : p,
  );
  for (const p of b.parts) if (!a.parts.some((left) => left.number === p.number)) q.parts.push(p);
  return q;
}
/** Copies are reconciled only inside their owning resource directory. */
export function reconcileCopies(candidates: Question[], diagnostics: Issue[]): Question[] {
  const result: Question[] = [];
  for (const candidate of candidates) {
    let handled = false;
    for (const [i, prior] of result.entries()) {
      if (prior.id !== candidate.id || prior.kind !== candidate.kind) continue;
      if (prior.identity?.origin !== candidate.identity?.origin) continue;
      try {
        const equivalent = equivalentQuestions(prior, candidate);
        const combined = equivalent ? { ...prior } : merge(prior, candidate);
        const numbered = new Map(
          candidate.parts.filter((p) => !!p.number).map((p) => [p.number, p]),
        );
        if (numbered.size === candidate.parts.length)
          combined.parts = combined.parts.map((p) => {
            const alternate = numbered.get(p.number);
            if (!alternate) return p;
            const sourceLabels = [
              ...(p.sourceNumberLabels || []),
              ...(alternate.sourceNumberLabels || []),
            ];
            const base = sourceLabels.length
              ? {
                  ...p,
                  sourceNumberLabels: sourceLabels.filter(
                    (label, i) => sourceLabels.findIndex((other) => same(label, other)) === i,
                  ),
                }
              : p;
            if (alternate.prompt === p.prompt || !promptsEquivalent(p, alternate)) return base;
            return {
              ...base,
              promptVariants: [
                ...(p.promptVariants || []),
                { source: candidate.source, text: alternate.prompt },
              ],
            };
          });
        result[i] = {
          ...combined,
          sourceFiles: [...(prior.sourceFiles || [prior.source]), candidate.source],
        };
        diagnostics.push({
          path: candidate.source,
          questionId: candidate.id,
          structureType: candidate.kind,
          severity: 'info',
          code: equivalent ? 'equivalent_copy' : 'complementary_copy',
          message: equivalent
            ? 'Equivalent resource copy loaded once'
            : 'Complementary fields merged by explicit group and question IDs',
        });
        handled = true;
        break;
      } catch (error) {
        if (!(error instanceof Conflict)) throw error;
      }
    }
    if (!handled) {
      if (result.some((q) => q.id === candidate.id && q.kind === candidate.kind))
        diagnostics.push({
          path: candidate.source,
          questionId: candidate.id,
          structureType: candidate.kind,
          severity: 'warning',
          code: 'conflicting_copies',
          message:
            'Different or ambiguously related revisions retained separately; no filename precedence was assumed',
        });
      result.push({ ...candidate, sourceFiles: [candidate.source] });
    }
  }
  return result;
}
