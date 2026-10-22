export function Icon({
  name,
  size = 18,
}: {
  name:
    | 'folder'
    | 'zip'
    | 'arrow'
    | 'chevron'
    | 'sidebar'
    | 'book'
    | 'check'
    | 'settings'
    | 'shield'
    | 'download'
    | 'close'
    | 'warning'
    | 'eye'
    | 'github';
  size?: number;
}) {
  const paths = {
    folder: 'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
    zip: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M10 4h1m-1 3h1m-1 3h1m-1 3h1m-2 3h3v3H9v-3Z',
    arrow: 'm14 6-6 6 6 6M8 12h13',
    chevron: 'm6 9 6 6 6-6',
    sidebar: 'M9 3v18M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
    book: 'M12 5v16M3 3h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3V3Z',
    check: 'm5 12 4 4L19 6',
    settings: 'M9 4h6l1 3 3 1v8l-3 1-1 3H9l-1-3-3-1V8l3-1 1-3Zm3 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-4 9 3 3 5-6',
    download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
    close: 'm6 6 12 12M6 18 18 6',
    warning: 'M12 3 2 21h20L12 3Zm0 6v5m0 3h.01',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    github:
      'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z',
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox={name === 'github' ? '0 0 16 16' : '0 0 24 24'}
      fill={name === 'github' ? 'currentColor' : 'none'}
      stroke={name === 'github' ? 'none' : 'currentColor'}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
