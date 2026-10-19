import { useEffect, useRef, useState } from 'react';
import { folderFiles } from '../core/importer';
import { bankName } from '../core/paths';
import { ImageResources } from '../core/images';
import type { Bank, Progress } from '../types';
import type { ImportRequest } from '../workers/import.worker';
export function useBank() {
  const [bank, setBank] = useState<Bank | null>(null),
    [progress, setProgress] = useState<Progress | null>(null),
    [error, setError] = useState('');
  const worker = useRef<Worker | null>(null),
    resources = useRef<ImageResources | null>(null);
  const stop = () => {
    worker.current?.terminate();
    worker.current = null;
  };
  useEffect(
    () => () => {
      stop();
      resources.current?.dispose();
    },
    [],
  );
  function start(request: ImportRequest) {
    stop();
    setError('');
    setProgress({ phase: 'Reading files...', completed: 0, total: 0 });
    try {
      const w = new Worker(new URL('../workers/import.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.current = w;
      w.onmessage = ({ data }) => {
        if (worker.current !== w) return;
        if (data.type === 'progress') setProgress(data.progress);
        if (data.type === 'ready') {
          resources.current?.dispose();
          resources.current = new ImageResources(data.bank.assets);
          setBank(data.bank);
          setProgress(null);
          stop();
        }
        if (data.type === 'error') {
          setError(data.message);
          setProgress(null);
          stop();
        }
      };
      w.onerror = () => {
        if (worker.current !== w) return;
        setError('The import worker could not complete. Try a smaller bank or a current browser.');
        setProgress(null);
        stop();
      };
      w.postMessage(request);
    } catch {
      setError('This browser could not start local processing. Try a current browser.');
      setProgress(null);
      stop();
    }
  }
  return {
    bank,
    progress,
    error,
    resources: resources.current,
    importFolder(files: File[]) {
      if (!files.length) return;
      try {
        const entries = folderFiles(files);
        start({
          mode: 'folder',
          files: entries,
          name: bankName(
            entries.map((f) => f.path),
            'ETS bank',
          ),
        });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    importZip(file: File) {
      start({ mode: 'zip', file });
    },
    cancel() {
      stop();
      setProgress(null);
    },
    changeBank() {
      stop();
      resources.current?.dispose();
      resources.current = null;
      setBank(null);
      setError('');
      setProgress(null);
    },
  };
}
