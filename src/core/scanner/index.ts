import type { Bank, Issue, Progress, Question, VirtualFile } from '../../types';
import { metadataAnswerMap, parseDocument } from '../parser';
import { baseName, normalizePath, parentPath, taskFolder } from '../paths';
import { isRaster, LIMITS, supportAsset } from '../importer';
import { imageReferences } from '../markup';
import { imageHeader, resolveImage } from '../images';
const COPIES = ['content.json', 'content2.json', 'info.json'];
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
async function json(blob: Blob): Promise<unknown> {
  if (blob.size > LIMITS.fileBytes) throw new Error('Data file exceeds the 32 MiB parsing limit');
  const b = new Uint8Array(await blob.arrayBuffer());
  const encoding =
    b[0] === 255 && b[1] === 254 ? 'utf-16le' : b[0] === 254 && b[1] === 255 ? 'utf-16be' : 'utf-8';
  return JSON.parse(new TextDecoder(encoding, { fatal: true }).decode(b));
}
function allReferences(q: Question): string[] {
  const strings = [q.context, q.instructions, q.topic, q.explanation, q.keyPoints];
  const refs = [...q.images];
  for (const p of q.parts) {
    refs.push(...p.images);
    strings.push(
      p.prompt,
      p.context,
      p.translation,
      p.explanation,
      ...p.options.map((o) => o.text),
      ...p.answers.map((a) => a.text),
    );
  }
  return [...refs, ...strings.flatMap(imageReferences)];
}
export async function scanBank(
  input: VirtualFile[],
  name: string,
  progress?: (p: Progress) => void,
): Promise<Bank> {
  const issues: Issue[] = [],
    questions: Question[] = [],
    assets = new Map<string, Blob>(),
    files = new Map<string, VirtualFile>();
  if (input.length > LIMITS.entries) throw new Error('Bank entry limit exceeded');
  for (const f of input) {
    const path = normalizePath(f.path);
    if (files.has(path)) throw new Error('Duplicate file path: ' + path);
    files.set(path, { path, blob: f.blob });
    if (isRaster(path)) assets.set(path, f.blob);
  }
  // Python os.walk: files in a directory first, then sorted child directories.
  const order = (a: string, b: string): number => {
    const ad = parentPath(a).split('/'),
      bd = parentPath(b).split('/');
    for (let i = 0; i < Math.min(ad.length, bd.length); i++)
      if (ad[i] !== bd[i]) return ad[i] < bd[i] ? -1 : 1;
    if (ad.length !== bd.length) return ad.length - bd.length;
    return baseName(a) < baseName(b) ? -1 : baseName(a) > baseName(b) ? 1 : 0;
  };
  const groups = new Map<string, Map<string, VirtualFile>>(),
    others: VirtualFile[] = [];
  for (const f of [...files.values()].sort((a, b) => order(a.path, b.path))) {
    const filename = baseName(f.path),
      folder = parentPath(f.path);
    if (COPIES.includes(filename) && !supportAsset(f.path)) {
      if (!groups.has(folder)) groups.set(folder, new Map());
      groups.get(folder)!.set(filename, f);
    } else others.push(f);
  }
  let done = 0;
  const advance = async (n = 1) => {
    done += n;
    progress?.({ phase: 'Parsing questions...', completed: done, total: files.size });
    if (done % 25 === 0) await new Promise((r) => setTimeout(r, 0));
  };
  progress?.({ phase: 'Parsing questions...', completed: 0, total: files.size });
  for (const copies of groups.values()) {
    let metadata: unknown;
    const meta = copies.get('info.json');
    if (meta)
      try {
        metadata = await json(meta.blob);
        metadataAnswerMap(metadata);
      } catch (e) {
        issues.push({ path: meta.path, message: 'Cannot read metadata: ' + errorText(e) });
        metadata = undefined;
      }
    for (const filename of COPIES) {
      const f = copies.get(filename);
      if (!f || (filename === 'info.json' && metadata === undefined)) continue;
      try {
        questions.push(
          parseDocument(filename === 'info.json' ? metadata : await json(f.blob), f.path, metadata),
        );
        break;
      } catch (e) {
        issues.push({ path: f.path, message: 'Cannot load this copy: ' + errorText(e) });
      }
    }
    await advance(copies.size);
  }
  for (const f of others) {
    if (!supportAsset(f.path))
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
        if (/^[{[\ufffd]/.test(header) || /\.json$/i.test(f.path))
          questions.push(parseDocument(await json(f.blob), f.path));
        else throw new Error('Unsupported file format; unknown/encrypted data is not decoded');
      } catch (e) {
        issues.push({ path: f.path, message: 'Cannot load file: ' + errorText(e) });
      }
    await advance();
  }
  const papers = new Map<string, Bank['papers'][number]>();
  for (const q of questions) {
    const key = taskFolder(q.source);
    if (!papers.has(key))
      papers.set(key, { key, id: baseName(key) || name, questions: [], modified: null });
    papers.get(key)!.questions.push(q);
  }
  const checks = new Map<string, Promise<unknown>>();
  for (const [i, q] of questions.entries()) {
    for (const ref of new Set(allReferences(q))) {
      const path = resolveImage(ref, q.source, assets);
      if (!path) {
        issues.push({ path: q.source, message: 'Image unavailable: ' + ref });
        continue;
      }
      if (!checks.has(path))
        checks.set(
          path,
          imageHeader(assets.get(path)!).catch((e) => {
            issues.push({ path, message: 'Image unavailable: ' + errorText(e) });
            assets.delete(path);
          }),
        );
      await checks.get(path);
    }
    progress?.({ phase: 'Processing images...', completed: i + 1, total: questions.length });
  }
  progress?.({ phase: 'Ready', completed: files.size, total: files.size });
  return { name, papers: [...papers.values()], issues, filesScanned: files.size, assets };
}
