import type { Progress } from '../types';

export interface ImportMessage {
  key: string;
  params?: Record<string, string | number>;
}

const phaseKeys: Record<Progress['phase'], string> = {
  'Reading files...': 'import.progress.reading',
  'Parsing questions...': 'import.progress.parsing',
  'Processing images...': 'import.progress.images',
  'Processing media...': 'import.progress.media',
  Ready: 'import.progress.ready',
};
export const importPhaseKey = (phase: Progress['phase']): string => phaseKeys[phase];

const errorKeys: Record<string, string> = {
  'No files were returned. Select a question-bank folder or Import ZIP.':
    'import.errors.emptyFolder',
  'Folder entry limit exceeded. Import a smaller bank.': 'import.errors.folderEntries',
  'This browser did not return folder-relative paths. Use Import ZIP to preserve the complete bank.':
    'import.errors.relativePaths',
  'This browser did not return folder-relative paths. Use Import ZIP.':
    'import.errors.relativePaths',
  'Folder paths are incomplete. Use Import ZIP.': 'import.errors.incompletePaths',
  'Folder paths have inconsistent roots. Use Import ZIP.': 'import.errors.inconsistentRoots',
  'Folder size limit (1 GiB) exceeded. Select a smaller bank.': 'import.errors.folderSize',
  'ZIP compressed-size limit (128 MiB) exceeded.': 'import.errors.zipSize',
  'Bank entry limit exceeded': 'import.errors.bankEntries',
  'Data file exceeds the 32 MiB parsing limit': 'import.errors.dataSize',
  'Unsafe archive or file path': 'import.errors.unsafePath',
  'Unsafe or ambiguous archive path': 'import.errors.ambiguousPath',
  'The import worker could not complete. Try a smaller bank or a current browser.':
    'import.errors.worker',
  'This browser could not start local processing. Try a current browser.': 'import.errors.browser',
};
const zipKeys: Record<string, string> = {
  'truncated archive': 'truncated',
  'missing end directory': 'endDirectory',
  'multi-volume archives are unsupported': 'multiVolume',
  'ZIP64 archives are unsupported': 'zip64',
  'entry-count limit exceeded': 'entries',
  'invalid directory bounds': 'directoryBounds',
  'corrupt directory': 'directory',
  'truncated directory entry': 'directoryEntry',
  'filename encoding must be UTF-8; re-create the ZIP with Unicode filenames': 'encoding',
  'encrypted or unsupported compression': 'compression',
  'symbolic links are unsupported': 'symlinks',
  'duplicate path': 'duplicate',
  'uncompressed-size limit exceeded': 'uncompressedSize',
  'file-size limit exceeded': 'fileSize',
  'missing local header': 'localHeader',
  'local header mismatch': 'headerMismatch',
  'invalid entry bounds': 'entryBounds',
  'local size or CRC mismatch': 'sizeCrc',
  'directory size mismatch': 'directorySize',
  'actual decompression limit exceeded': 'decompression',
  'empty deflate stream': 'emptyStream',
  'corrupt uncompressed size': 'uncompressedMismatch',
  'corrupt CRC': 'crc',
};

/** Translation-free boundary shared with the worker; raw internal errors remain intact.
 * Only recognized source-relative paths may be interpolated into the interface.
 */
export function importErrorMessage(message: string): ImportMessage {
  if (Object.hasOwn(errorKeys, message)) return { key: errorKeys[message] };
  if (message.startsWith('Invalid ZIP: ')) {
    const reason = message.slice('Invalid ZIP: '.length);
    return {
      key: Object.hasOwn(zipKeys, reason)
        ? `import.errors.zip.${zipKeys[reason]}`
        : 'import.errors.zip.invalid',
    };
  }
  for (const [prefix, key] of [
    ['Duplicate folder path: ', 'import.errors.duplicateFolder'],
    ['Duplicate file path: ', 'import.errors.duplicateFile'],
  ]) {
    if (!message.startsWith(prefix)) continue;
    const path = message.slice(prefix.length);
    // Do not expose absolute OS paths or traversal from unexpected errors.
    if (
      path &&
      !/^[\\/]|[\u0000-\u001f\u007f:]/.test(path) &&
      !path.split(/[\\/]/).some((part) => !part || part === '.' || part === '..')
    )
      return { key, params: { path } };
  }
  return { key: 'import.errors.unknown' };
}
