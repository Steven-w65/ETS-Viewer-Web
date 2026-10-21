import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../src/App';
import { Reader } from '../src/components/Reader';
import { FolderLocations } from '../src/components/FolderLocations';
import { parseDocument } from '../src/core/parser';
import { ImageResources } from '../src/core/images';
import { AnimatedPanel, AnimatedDisclosure } from '../src/components/AnimatedDisclosure';
import { Warnings } from '../src/components/Warnings';
import { Toast } from '../src/components/Toast';

vi.mock('../src/hooks/useBank', () => ({
  useBank: () => ({
    bank: null,
    error: '',
    progress: null,
    importFolder: vi.fn(),
    importZip: vi.fn(),
    cancel: vi.fn(),
  }),
}));
const question = parseDocument(
  {
    structure_type: 'collector.picture',
    info: { stid: 'one', value: 'Original prompt', std: [{ value: 'Stored answer' }] },
  },
  'bank/p/content.json',
);
const resources = new ImageResources(new Map());
let reduced = false;
let change: EventTarget;
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  change = new EventTarget();
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        get matches() {
          return query.includes('reduced-motion') && reduced;
        },
        media: query,
        addEventListener: change.addEventListener.bind(change),
        removeEventListener: change.removeEventListener.bind(change),
      }) as MediaQueryList,
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty('--motion-duration-normal');
});
it('adapts to intrinsic size changes and disconnects the observer when removed', () => {
  let resize: ResizeObserverCallback = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const view = render(
    <AnimatedPanel id="dynamic" open>
      <div>Dynamic contents</div>
    </AnimatedPanel>,
  );
  const panel = document.getElementById('dynamic')!;
  const grow = (height: number) =>
    act(() => resize([{ contentRect: { height } } as ResizeObserverEntry], {} as ResizeObserver));
  grow(160);
  expect(panel.style.height).toBe('160px');
  grow(460);
  expect(panel.style.height).toBe('460px');
  view.rerender(
    <AnimatedPanel id="dynamic" open={false}>
      <div>Dynamic contents</div>
    </AnimatedPanel>,
  );
  grow(520);
  expect(panel.style.height).toBe('0px');
  view.rerender(
    <AnimatedPanel id="dynamic" open>
      <div>Dynamic contents</div>
    </AnimatedPanel>,
  );
  expect(panel.style.height).toBe('520px');
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
it('returns focus from arbitrary disclosure content before making it inert', () => {
  render(
    <AnimatedDisclosure label="Details">
      <button>Inner control</button>
    </AnimatedDisclosure>,
  );
  const trigger = screen.getByRole('button', { name: 'Details' });
  fireEvent.click(trigger);
  screen.getByRole('button', { name: 'Inner control' }).focus();
  fireEvent.click(trigger);
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole('button', { name: 'Inner control' })).toBeNull();
});
it('keeps toast contents stable through exit reversal and releases them on live reduced motion', () => {
  const view = render(<Toast message="First message" />);
  const toast = screen.getByRole('status');
  view.rerender(<Toast message="" />);
  tick(50);
  view.rerender(<Toast message="New message" />);
  tick(200);
  expect(screen.getByRole('status')).toBe(toast);
  expect(toast).toHaveTextContent('New message');
  view.rerender(<Toast message="" />);
  act(() => {
    reduced = true;
    change.dispatchEvent(new Event('change'));
  });
  expect(screen.queryByRole('status')).toBeNull();
});
it('cancels a stale warning close on reopening and honors live reduced motion', () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  const issues = [{ path: 'bank/content.json', message: 'Warning', severity: 'warning' as const }];
  render(<Warnings issues={issues} hasQuestions />);
  const trigger = screen.getByRole('button', { name: 'View 1 import warning' });
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Close import warnings' }));
  tick(50);
  fireEvent.click(trigger);
  tick(200);
  expect(screen.getByRole('dialog')).toBe(dialog);
  fireEvent.click(screen.getByRole('button', { name: 'Close import warnings' }));
  act(() => {
    reduced = true;
    change.dispatchEvent(new Event('change'));
  });
  tick(0);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).not.toBe('hidden');
});
const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
it('retains disclosure contents until the configured CSS exit duration finishes', () => {
  document.documentElement.style.setProperty('--motion-duration-normal', '400ms');
  render(<Reader question={question} resources={resources} />);
  const toggle = screen.getByRole('button', { name: /^Question / });
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  tick(220);
  expect(screen.getByText('Original prompt', { selector: '.rich-text' })).toBeInTheDocument();
  tick(180);
  expect(screen.queryByText('Original prompt', { selector: '.rich-text' })).toBeNull();
  expect(screen.getByText('Stored answer')).toBeVisible();
});
it('keeps the same child during rapid reversal and cancels stale removal', () => {
  render(<Reader question={question} resources={resources} />);
  const toggle = screen.getByRole('button', { name: /^Question / });
  fireEvent.click(toggle);
  const original = screen.getByText('Original prompt', { selector: '.rich-text' });
  fireEvent.click(toggle);
  tick(60);
  fireEvent.click(toggle);
  tick(300);
  expect(screen.getByText('Original prompt', { selector: '.rich-text' })).toBe(original);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
});
it('finishes a pending disclosure exit when reduced motion becomes enabled', () => {
  render(<Reader question={question} resources={resources} />);
  const toggle = screen.getByRole('button', { name: /^Question / });
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  act(() => {
    reduced = true;
    change.dispatchEvent(new Event('change'));
  });
  tick(0);
  expect(screen.queryByText('Original prompt', { selector: '.rich-text' })).toBeNull();
});
it('returns focus from a guide control before making the closed content inert', () => {
  render(<FolderLocations />);
  const toggle = screen.getByRole('button', { name: 'Where are my question files?' });
  fireEvent.click(toggle);
  screen.getByRole('button', { name: 'Copy Windows folder path' }).focus();
  fireEvent.click(toggle);
  expect(toggle).toHaveFocus();
  expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toHaveAttribute('inert');
});
it('retains Settings for its exit while returning keyboard focus to the trigger', () => {
  render(<App />);
  const trigger = screen.getByRole('button', { name: 'Settings' });
  fireEvent.click(trigger);
  const radio = screen.getByRole('radio', { name: 'Dark' });
  radio.focus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(trigger).toHaveFocus();
  expect(radio).toBeInTheDocument();
  expect(radio.closest('.settings-menu')).toHaveAttribute('inert');
  tick(180);
  expect(radio).not.toBeInTheDocument();
});
it('reopening Settings during exit preserves its controls and cancels exit cleanup', () => {
  render(<App />);
  const trigger = screen.getByRole('button', { name: 'Settings' });
  fireEvent.click(trigger);
  const radio = screen.getByRole('radio', { name: 'Dark' });
  fireEvent.click(trigger);
  tick(60);
  fireEvent.click(trigger);
  tick(200);
  expect(screen.getByRole('radio', { name: 'Dark' })).toBe(radio);
});
