import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Progress } from '../types';
import { importErrorMessage, importPhaseKey, type ImportMessage } from '../i18n/importMessages';
import { Icon } from './Icon';
import { FolderLocations } from './FolderLocations';
interface Props {
  onFolder: (files: File[]) => void;
  onZip: (file: File) => void;
  error?: string;
  errorDescriptor?: ImportMessage | null;
  progress?: Progress | null;
  onCancel?: () => void;
}
export function ImportScreen({
  onFolder,
  onZip,
  error,
  errorDescriptor,
  progress,
  onCancel,
}: Props) {
  const { t, i18n } = useTranslation();
  const failure = errorDescriptor ?? (error ? importErrorMessage(error) : null);
  const folder = useRef<HTMLInputElement>(null),
    zip = useRef<HTMLInputElement>(null);
  return (
    <main className="import-screen">
      <div className="welcome">
        <div className="welcome-mark">
          <Icon name="book" size={26} />
        </div>
        <h1>ETS Viewer</h1>
        <p className="welcome-description">{t('welcome.description')}</p>
        <div className="import-actions">
          <button
            className="primary-button"
            onClick={() => folder.current?.click()}
            disabled={!!progress}
          >
            <Icon name="folder" />
            {t('welcome.selectFolder')}
          </button>
          <button
            className="outlined-button"
            onClick={() => zip.current?.click()}
            disabled={!!progress}
          >
            <Icon name="zip" />
            {t('welcome.importZip')}
          </button>
        </div>
        <FolderLocations />
        <input
          ref={(el) => {
            folder.current = el;
            if (el) el.setAttribute('webkitdirectory', '');
          }}
          type="file"
          multiple
          aria-label={t('welcome.folderInput')}
          className="file-input"
          onChange={(e) => {
            const files = Array.from(e.currentTarget.files ?? []);
            e.currentTarget.value = '';
            if (files.length) onFolder(files);
          }}
        />
        <input
          ref={zip}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          aria-label={t('welcome.zipInput')}
          className="file-input"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (f) onZip(f);
          }}
        />
        {progress && (
          <div className="import-progress" role="status" aria-live="polite">
            <p>
              {t(importPhaseKey(progress.phase))}
              {progress.total > 0 && (
                <span>
                  {t('import.progressCounts', {
                    completed: progress.completed.toLocaleString(i18n.resolvedLanguage),
                    total: progress.total.toLocaleString(i18n.resolvedLanguage),
                  })}
                </span>
              )}
            </p>
            <progress
              aria-label={t('import.progressLabel')}
              max={progress.total || undefined}
              value={progress.total ? progress.completed : undefined}
            />
            <button className="text-button" onClick={onCancel}>
              {t('import.cancel')}
            </button>
          </div>
        )}
        {failure && (
          <div className="inline-error" role="alert">
            {t(failure.key, failure.params ?? {})}
          </div>
        )}
        <p className="privacy">{t('welcome.privacy')}</p>
      </div>
    </main>
  );
}
