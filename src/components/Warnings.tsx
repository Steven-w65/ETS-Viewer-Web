import { useState } from 'react';
import type { Issue } from '../types';
export function Warnings({ issues }: { issues: Issue[] }) {
  const [open, setOpen] = useState(false),
    [limit, setLimit] = useState(100);
  if (!issues.length) return null;
  return (
    <div className="warnings">
      <button className="warnings-button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {issues.length.toLocaleString()} import {issues.length === 1 ? 'warning' : 'warnings'}{' '}
        <span>{open ? 'Hide details' : 'Review'}</span>
      </button>
      {open && (
        <div className="warning-details">
          <p>
            Valid question groups are available. These source records or images could not be loaded.
          </p>
          <ul>
            {issues.slice(0, limit).map((issue, i) => (
              <li key={i}>
                <code>{issue.path}</code>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
          {limit < issues.length && (
            <button onClick={() => setLimit(limit + 100)}>Show more warnings</button>
          )}
        </div>
      )}
    </div>
  );
}
