import { useRef } from 'react';
import type { Progress } from '../types';
import { Icon } from './Icon';
interface Props {
  onFolder: (files: File[]) => void;
  onZip: (file: File) => void;
  error?: string;
  progress?: Progress | null;
  onCancel?: () => void;
}
export function ImportScreen({ onFolder, onZip, error, progress, onCancel }: Props) {
  const folder = useRef<HTMLInputElement>(null),
    zip = useRef<HTMLInputElement>(null);
  return (
    <main className="import-screen">
      <div className="welcome">
        <div className="welcome-mark">
          <Icon name="book" size={30} />
        </div>
        <span className="eyebrow">YOUR ANSWERS, AT HAND</span>
        <h1>ETS Viewer</h1>
        <p className="welcome-description">View your ETS reference answers.</p>
        <p className="welcome-hint">Open a local question bank to begin.</p>
        <div className="import-actions">
          <button
            className="primary-button"
            onClick={() => folder.current?.click()}
            disabled={!!progress}
          >
            <Icon name="folder" />
            Select Folder
          </button>
          <button
            className="outlined-button"
            onClick={() => zip.current?.click()}
            disabled={!!progress}
          >
            <Icon name="zip" />
            Import ZIP
          </button>
        </div>
        <input
          ref={(el) => {
            folder.current = el;
            if (el) el.setAttribute('webkitdirectory', '');
          }}
          type="file"
          multiple
          aria-label="Select question-bank folder"
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
          aria-label="Select question-bank ZIP"
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
              {progress.phase}
              {progress.total > 0 && (
                <span>
                  {progress.completed.toLocaleString()} / {progress.total.toLocaleString()}
                </span>
              )}
            </p>
            <progress
              max={progress.total || undefined}
              value={progress.total ? progress.completed : undefined}
            />
            <button className="text-button" onClick={onCancel}>
              Cancel import
            </button>
          </div>
        )}
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        <p className="privacy">
          <Icon name="shield" size={16} />
          <span>
            Your files are processed locally.
            <br />
            Nothing is uploaded.
          </span>
        </p>
        <p className="compatibility">
          Folder selection depends on your browser.
          <br />
          Import ZIP is available on desktop, Android and iOS.
        </p>
      </div>
    </main>
  );
}
