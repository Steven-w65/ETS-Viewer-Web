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
    | 'close';
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
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
