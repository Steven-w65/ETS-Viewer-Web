import { useLayoutEffect, useState, useSyncExternalStore } from 'react';

type MotionDuration = 'normal' | 'overlay';
const preference = '(prefers-reduced-motion: reduce)';
const subscribe = (change: () => void) => {
  const query = window.matchMedia(preference);
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
};
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(preference).matches,
    () => true,
  );
}
// Read once per interaction, so CSS timing changes cannot outlive retained content.
export function motionDuration(name: MotionDuration) {
  if (window.matchMedia(preference).matches) return 0;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--motion-duration-' + name)
    .trim();
  const milliseconds = Number.parseFloat(value) * (value.endsWith('ms') ? 1 : 1000);
  return Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : name === 'normal' ? 200 : 180;
}
export function usePresence(open: boolean, duration: MotionDuration = 'normal') {
  const [retained, setRetained] = useState(open);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    if (open) {
      setRetained(true);
      return;
    }
    if (reduced) {
      setRetained(false);
      return;
    }
    if (!retained) return;
    const timer = setTimeout(() => setRetained(false), motionDuration(duration));
    return () => clearTimeout(timer);
  }, [open, reduced, duration, retained]);
  return open || retained;
}
export function restoreDisclosureFocus(panelId: string, trigger: HTMLButtonElement | null) {
  if (document.getElementById(panelId)?.contains(document.activeElement)) trigger?.focus();
}
