import type { Issue, Question } from '../../types';
import type { ParseOptions } from '../parser/types';
import { isObject } from '../parser/utils/validation';
import { parentPath, baseName, normalizePath } from '../paths';
type ObjectValue = Record<string, unknown>;
const list = (v: unknown): ObjectValue[] => (Array.isArray(v) ? v.filter(isObject) : []);
const scalar = (v: unknown) =>
  typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
const join = (root: string, path: string) => (root ? root + '/' + path : path);
export interface PaperBinding {
  key: string;
  id: string;
  title?: string;
  order: number;
}
export class ResourceMetadata {
  private bindings = new Map<string, PaperBinding[]>();
  private local = new Map<string, unknown>();
  readonly consumed = new Set<string>();
  constructor(
    private folders: Set<string>,
    private diagnostics: Issue[],
  ) {}
  add(path: string, data: unknown): boolean {
    if (
      baseName(path) === 'res.json' ||
      baseName(path) === 'ctrl.json' ||
      baseName(path) === 'ctrl_check.json'
    ) {
      this.local.set(path, data);
      this.consumed.add(path);
      return true;
    }
    if (!isObject(data)) return false;
    const parent = parentPath(path),
      isData = baseName(parent) === 'data';
    let recognized = false;
    const bind = (id: string, title: string, ids: string[], root: string) => {
      if (!id || !ids.length) return;
      recognized = true;
      ids.forEach((resource, order) => {
        // Explicit IDs resolve only under this metadata document's resource root.
        let folder: string;
        try {
          const safe = normalizePath(resource);
          folder = join(root, safe.startsWith('resource/') ? safe : 'resource/' + safe);
        } catch {
          this.warn(path, 'Unsafe resource relationship ignored');
          return;
        }
        if (!this.folders.has(folder)) {
          this.warn(path, 'Referenced resource is unavailable: ' + resource);
          return;
        }
        const binding = { key: join(root, 'data/' + id), id, ...(title ? { title } : {}), order };
        const prior = this.bindings.get(folder) || [];
        if (!prior.some((p) => p.key === binding.key && p.order === order)) prior.push(binding);
        this.bindings.set(folder, prior);
      });
    };
    if (isData && Array.isArray(data.sectionData)) {
      const ids = list(data.sectionData)
        .flatMap((section) => list(section.sectionItemData).map((item) => scalar(item.fileName)))
        .filter(Boolean);
      bind(
        scalar(data.id) || baseName(path).replace(/\.json$/i, ''),
        scalar(data.name),
        ids,
        parentPath(parent),
      );
      recognized = true;
    }
    const items = list(data.items);
    if (isObject(data.byId))
      for (const [id, row] of Object.entries(data.byId))
        if (isObject(row)) items.push({ ...row, id });
    for (const item of items) {
      const values = item.fileIdentifiers ?? item.file_identifiers;
      if (!Array.isArray(values)) continue;
      bind(scalar(item.id), scalar(item.name), values.map(scalar).filter(Boolean), parent);
      recognized = true;
    }
    if (recognized) this.consumed.add(path);
    return recognized;
  }
  binding(source: string): PaperBinding | undefined {
    const bindings = this.bindings.get(parentPath(source));
    if (!bindings?.length) return undefined;
    if (bindings.length === 1) return bindings[0];
    this.warn(
      source,
      'Resource has conflicting paper ownership or ordering; keeping physical grouping',
    );
    return undefined;
  }
  options(source: string, kind: string, id: string): ParseOptions {
    const data = this.local.get(join(parentPath(source), 'res.json'));
    if (!isObject(data)) return {};
    const matches = list(data.exam_type_list).filter((row) => row.exam_type_collect === kind);
    if (matches.length !== 1) {
      if (matches.length > 1) this.warn(source, 'Ambiguous collector metadata ignored');
      return {};
    }
    const row = matches[0],
      exams = list(row.exam_list);
    const exact = exams.filter((exam) => scalar(exam.exam_id) === id);
    // No numeric offsets or nearest-ID matching. A singleton is used only when it has no conflicting ID.
    const exam =
      exact.length === 1
        ? exact[0]
        : !exact.length && exams.length === 1 && !scalar(exams[0].exam_id)
          ? exams[0]
          : undefined;
    const title = scalar(row.exam_type_name),
      officialNumbers = new Map<string, string>();
    const ambiguous = new Set<string>();
    if (exam || scalar(row.exam_id) === id) {
      for (const item of list((exam || row).exam_info)) {
        const value = scalar(item.value);
        const match = value.match(/^\s*(ets_th\d+)(?:\s*=\s*|\s+)(\d+)[.、．]?\s*$/);
        if (!match) continue;
        if (ambiguous.has(match[1])) continue;
        if (officialNumbers.has(match[1]) && officialNumbers.get(match[1]) !== match[2]) {
          officialNumbers.delete(match[1]);
          ambiguous.add(match[1]);
          this.warn(source, 'Conflicting explicit template number mapping ignored');
        } else officialNumbers.set(match[1], match[2]);
      }
    }
    return {
      ...(title ? { displayTitle: title } : {}),
      ...(officialNumbers.size ? { officialNumbers } : {}),
    };
  }
  attach(question: Question): PaperBinding | undefined {
    return this.binding(question.source);
  }
  private warn(path: string, message: string) {
    this.diagnostics.push({ path, message, severity: 'warning', code: 'ambiguous_metadata' });
  }
}
