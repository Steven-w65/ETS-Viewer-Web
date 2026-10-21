import type { Bank, Issue, Progress, Question, VirtualFile, VirtualEntry } from '../../types';
import { metadataAnswerMap, parseDocumentResult } from '../parser';
import { isObject } from '../parser/utils/validation';
import { baseName, normalizePath, parentPath, taskFolder } from '../paths';
import { LIMITS, supportAsset } from '../importer';
import { isMediaPath } from '../media/classify';
import { resolveMedia } from '../media/resolve';
import { MediaError, mediaError, type ResolvedMedia } from '../media/types';
import { questionMedia } from '../media/references';
import { importWarnings, issueMessage } from '../diagnostics';
import { reconcileCopies } from './copies';
import { ResourceMetadata } from './metadata';
import { validTimestamp } from '../dates';
const COPIES = ['content.json', 'content2.json', 'info.json'];
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
async function json(blob: Blob): Promise<unknown> {
  if (blob.size > LIMITS.fileBytes) throw new Error('Data file exceeds the 32 MiB parsing limit');
  const b = new Uint8Array(await blob.arrayBuffer());
  const encoding =
    b[0] === 255 && b[1] === 254 ? 'utf-16le' : b[0] === 254 && b[1] === 255 ? 'utf-16be' : 'utf-8';
  return JSON.parse(new TextDecoder(encoding, { fatal: true }).decode(b));
}
export async function scanBank(
  input: VirtualEntry[],
  name: string,
  progress?: (p: Progress) => void,
): Promise<Bank> {
  const diagnostics: Issue[] = [],
    questions: Question[] = [],
    assets = new Map<string, Blob>(),
    files = new Map<string, VirtualFile>(),
    directoryDates = new Map<string, number | null>();
  const coverage: NonNullable<Bank['coverage']> = {
    observed: Object.create(null),
    successful: 0,
    partial: 0,
    unsupported: 0,
    variants: Object.create(null),
  };
  if (input.length > LIMITS.entries) throw new Error('Bank entry limit exceeded');
  for (const f of input) {
    const path = normalizePath(f.path);
    if (files.has(path) || directoryDates.has(path))
      throw new Error('Duplicate file path: ' + path);
    if (f.directory) {
      directoryDates.set(path, validTimestamp(f.modified));
      continue;
    }
    files.set(path, { path, blob: f.blob });
    if (isMediaPath(path)) assets.set(path, f.blob);
  }
  // Preserve the established directory-first desktop ordering when metadata is unavailable.
  const order = (a: string, b: string): number => {
    const ad = parentPath(a).split('/'),
      bd = parentPath(b).split('/');
    for (let i = 0; i < Math.min(ad.length, bd.length); i++)
      if (ad[i] !== bd[i]) return ad[i] < bd[i] ? -1 : 1;
    if (ad.length !== bd.length) return ad.length - bd.length;
    return baseName(a) < baseName(b) ? -1 : baseName(a) > baseName(b) ? 1 : 0;
  };
  const ordered = [...files.values()].sort((a, b) => order(a.path, b.path));
  const groups = new Map<string, Map<string, VirtualFile>>(),
    others: VirtualFile[] = [];
  for (const f of ordered) {
    const filename = baseName(f.path),
      folder = parentPath(f.path);
    if (COPIES.includes(filename) && !supportAsset(f.path)) {
      if (!groups.has(folder)) groups.set(folder, new Map());
      groups.get(folder)!.set(filename, f);
    } else others.push(f);
  }
  const cache = new Map<string, Promise<unknown>>();
  const read = (f: VirtualFile) => {
    if (!cache.has(f.path)) cache.set(f.path, json(f.blob));
    return cache.get(f.path)!;
  };
  const resourceMetadata = new ResourceMetadata(new Set(groups.keys()), diagnostics);
  // Metadata is inspected as data only; it never chooses a collector parser.
  for (const f of others) {
    if (supportAsset(f.path)) continue;
    try {
      await resourceMetadata.add(f.path, await read(f));
    } catch {
      /* Report malformed files in the normal scan below. */
    }
  }
  let done = 0;
  const advance = async (n = 1) => {
    done += n;
    progress?.({ phase: 'Parsing questions...', completed: done, total: files.size });
    if (done % 25 === 0) await new Promise((r) => setTimeout(r, 0));
  };
  const observed = new Set<string>();
  const parse = (data: unknown, source: string, metadata?: unknown) => {
    const type =
      isObject(data) && typeof data.structure_type === 'string'
        ? data.structure_type
        : Array.isArray(data)
          ? 'collector.choose'
          : '';
    const id =
      isObject(data) &&
      isObject(data.info) &&
      (typeof data.info.stid === 'string' || typeof data.info.stid === 'number')
        ? String(data.info.stid).trim()
        : '';
    const result = parseDocumentResult(
      data,
      source,
      metadata,
      resourceMetadata.options(source, type, id),
    );
    diagnostics.push(...result.diagnostics);
    const observation = parentPath(source) + '/' + type;
    if (type && !observed.has(observation)) {
      observed.add(observation);
      coverage.observed[type] = (coverage.observed[type] || 0) + 1;
      if (result.diagnostics.some((d) => d.code === 'unsupported_structure'))
        coverage.unsupported++;
    }
    return result;
  };
  const failure = (path: string, error: unknown, message: string) =>
    diagnostics.push({
      path,
      message: message + errorText(error),
      severity: 'error',
      code: error instanceof SyntaxError ? 'invalid_json' : 'invalid_file',
    });
  progress?.({ phase: 'Parsing questions...', completed: 0, total: files.size });
  for (const copies of groups.values()) {
    let metadata: unknown;
    const meta = copies.get('info.json');
    if (meta)
      try {
        metadata = await read(meta);
        metadataAnswerMap(metadata);
      } catch (error) {
        failure(meta.path, error, 'Cannot read metadata: ');
        metadata = undefined;
      }
    const candidates: Question[] = [];
    let partial = false;
    for (const filename of ['content.json', 'content2.json']) {
      const f = copies.get(filename);
      if (!f) continue;
      try {
        const result = parse(await read(f), f.path, metadata);
        if (result.question) {
          candidates.push(result.question);
          partial ||= result.partial;
        }
      } catch (error) {
        failure(f.path, error, 'Cannot load this copy: ');
      }
    }
    if (!candidates.length && meta && metadata !== undefined) {
      const result = parse(metadata, meta.path, metadata);
      if (result.question) {
        candidates.push(result.question);
        partial ||= result.partial;
      }
    }
    const resolved = reconcileCopies(candidates, diagnostics);
    questions.push(...resolved);
    if (resolved.length) {
      if (partial) coverage.partial++;
      else coverage.successful++;
    }
    await advance(copies.size);
  }
  for (const f of others) {
    if (!supportAsset(f.path) && !resourceMetadata.consumed.has(f.path))
      try {
        const header = new TextDecoder()
          .decode(await f.blob.slice(0, 512).arrayBuffer())
          .replace(/^[\uFEFF\s]+/, '');
        if (header.startsWith('SQLite format 3\0'))
          throw new Error('SQLite detected; unknown database schema cannot be mapped');
        if (header.startsWith('<'))
          throw new Error('XML/text markup detected; no supported question schema');
        if (header.startsWith('[choice]'))
          throw new Error(
            'Standalone answer cache has no question ID mapping; no answers were assigned',
          );
        if (/^[{[\ufffd]/.test(header) || /\.json$/i.test(f.path)) {
          const result = parse(await read(f), f.path);
          if (result.question) {
            questions.push(result.question);
            if (result.partial) coverage.partial++;
            else coverage.successful++;
          }
        } else throw new Error('Unsupported file format; unknown/encrypted data is not decoded');
      } catch (error) {
        failure(f.path, error, 'Cannot load file: ');
      }
    await advance();
  }
  const papers = new Map<string, Bank['papers'][number]>(),
    metadataOrder = new Map<Question, number>();
  for (const q of questions) {
    const binding = resourceMetadata.attach(q),
      key = binding?.key || taskFolder(q.source);
    if (!papers.has(key))
      papers.set(key, {
        key,
        id: binding?.id || baseName(key) || name,
        questions: [],
        modified: directoryDates.get(key) ?? null,
        ...(binding?.title ? { title: binding.title } : {}),
      });
    q.paperId = papers.get(key)!.id;
    papers.get(key)!.questions.push(q);
    if (binding) metadataOrder.set(q, binding.order);
  }
  for (const paper of papers.values())
    paper.questions.sort(
      (a, b) =>
        (metadataOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (metadataOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
    );
  const checks = new Map<string, Promise<ResolvedMedia>>();
  for (const [i, q] of questions.entries()) {
    const seen = new Set<string>();
    for (const media of questionMedia(q)) {
      const key = JSON.stringify([
        q.source,
        media.kind,
        media.reference,
        media.reference ? undefined : media.field,
      ]);
      if (seen.has(key)) continue;
      seen.add(key);
      const decorate = (issue: Issue): Issue => {
        const diagnostic: Issue = {
          ...issue,
          mediaKind:
            !issue.mediaKind || issue.mediaKind === 'unknown' ? media.kind : issue.mediaKind,
          path: q.source,
          field: media.field,
          structureType: q.kind,
          questionId: q.id,
        };
        if (issue.severity !== 'info') diagnostic.message = issueMessage(diagnostic);
        return diagnostic;
      };
      try {
        if (!checks.has(key)) checks.set(key, resolveMedia(media.reference, q.source, assets));
        const resolved = await checks.get(key)!;
        diagnostics.push(...resolved.diagnostics.map(decorate));
      } catch (error) {
        const issue =
          error instanceof MediaError
            ? error.diagnostic
            : mediaError('file_read', media.reference, q.source, media.kind).diagnostic;
        diagnostics.push(decorate(issue));
      }
    }
    progress?.({ phase: 'Processing media...', completed: i + 1, total: questions.length });
  }
  for (const d of diagnostics)
    if (d.code === 'field_variant') {
      const key = `${d.structureType}:${d.field}`;
      coverage.variants[key] = (coverage.variants[key] || 0) + 1;
    }
  progress?.({ phase: 'Ready', completed: files.size, total: files.size });
  return {
    name,
    papers: [...papers.values()],
    issues: importWarnings(diagnostics),
    diagnostics,
    coverage,
    filesScanned: files.size,
    assets,
  };
}
