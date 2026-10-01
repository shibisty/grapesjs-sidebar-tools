import type { ElementTarget } from './types';

/** Resolves a selector / element / getter into an element (or null). */
export function resolveEl(target: ElementTarget | unknown): HTMLElement | null {
  let value: unknown = target;
  if (typeof value === 'function') {
    try {
      value = (value as () => unknown)();
    } catch {
      return null;
    }
  }
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return document.querySelector<HTMLElement>(value);
    } catch {
      return null; // invalid selector
    }
  }
  // nodeType instead of instanceof: works for elements from another realm too.
  return typeof value === 'object' && (value as Node).nodeType === 1 ? (value as HTMLElement) : null;
}
