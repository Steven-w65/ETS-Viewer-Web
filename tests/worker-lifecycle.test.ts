import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBank } from '../src/hooks/useBank';
class ImportWorker {
  static instances: ImportWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  constructor() {
    ImportWorker.instances.push(this);
  }
  postMessage() {}
  terminate() {
    this.terminated = true;
  }
  emit(data: unknown) {
    this.onmessage?.({ data });
  }
}
beforeEach(() => {
  ImportWorker.instances = [];
  vi.stubGlobal('Worker', ImportWorker);
});
afterEach(() => vi.unstubAllGlobals());
const bank = { name: 'bank', papers: [], issues: [], filesScanned: 0, assets: new Map() };
it('cancels a worker and ignores its late result without loading a bank', () => {
  const { result } = renderHook(useBank);
  act(() => result.current.importZip(new File(['zip'], 'bank.zip')));
  const worker = ImportWorker.instances[0];
  expect(result.current.progress?.phase).toBe('Reading files...');
  act(() => result.current.cancel());
  expect(worker.terminated).toBe(true);
  act(() => worker.emit({ type: 'ready', bank }));
  expect(result.current.bank).toBeNull();
  expect(result.current.progress).toBeNull();
});
it('does not let a stale worker error cancel a newer import', () => {
  const { result } = renderHook(useBank);
  act(() => result.current.importZip(new File(['one'], 'one.zip')));
  act(() => result.current.importZip(new File(['two'], 'two.zip')));
  const [oldWorker, currentWorker] = ImportWorker.instances;
  expect(oldWorker.terminated).toBe(true);
  act(() => oldWorker.onerror?.());
  expect(currentWorker.terminated).toBe(false);
  act(() => currentWorker.emit({ type: 'ready', bank }));
  expect(result.current.bank?.name).toBe('bank');
});
it('terminates the active import on unmount', () => {
  const { result, unmount } = renderHook(useBank);
  act(() => result.current.importZip(new File(['zip'], 'bank.zip')));
  unmount();
  expect(ImportWorker.instances[0].terminated).toBe(true);
});
