import { Icon } from './Icon';
export function Navigation({
  index,
  total,
  onChange,
}: {
  index: number;
  total: number;
  onChange: (index: number) => void;
}) {
  return (
    <nav className="group-navigation" aria-label="Question groups">
      <button disabled={index <= 0} onClick={() => onChange(index - 1)}>
        <Icon name="arrow" size={16} />
        Previous
      </button>
      <span aria-live="polite">
        {index + 1} / {total}
      </span>
      <button disabled={index >= total - 1} onClick={() => onChange(index + 1)}>
        Next
        <span className="flipped">
          <Icon name="arrow" size={16} />
        </span>
      </button>
    </nav>
  );
}
