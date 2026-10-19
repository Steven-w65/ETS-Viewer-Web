import { readZip } from '../core/importer';
import { scanBank } from '../core/scanner';
import { bankName } from '../core/paths';
import type { Progress, VirtualFile } from '../types';
export type ImportRequest =
  | { mode: 'folder'; files: VirtualFile[]; name: string }
  | { mode: 'zip'; file: File };
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ImportRequest>) => void) | null;
  postMessage: (data: unknown) => void;
};
scope.onmessage = async ({ data }) => {
  const progress = (p: Progress) => scope.postMessage({ type: 'progress', progress: p });
  try {
    let files: VirtualFile[], name: string;
    if (data.mode === 'zip') {
      files = await readZip(data.file, progress);
      name = bankName(
        files.map((f) => f.path),
        data.file.name.replace(/\.zip$/i, ''),
      );
    } else {
      files = data.files;
      name = data.name;
    }
    const bank = await scanBank(files, name, progress);
    scope.postMessage({ type: 'ready', bank });
  } catch (error) {
    scope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unable to import this bank.',
    });
  }
};
