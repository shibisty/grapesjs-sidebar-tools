import { describe, expect, it } from 'vitest';
import { resolveEl } from '../src/dom';

describe('resolveEl', () => {
  it('resolves selectors, elements and getters', () => {
    const el = document.createElement('div');
    el.id = 'target';
    document.body.appendChild(el);
    expect(resolveEl('#target')).toBe(el);
    expect(resolveEl(el)).toBe(el);
    expect(resolveEl(() => el)).toBe(el);
  });

  it('returns null for empty, invalid or non-element values', () => {
    expect(resolveEl(null)).toBeNull();
    expect(resolveEl('')).toBeNull();
    expect(resolveEl('#missing')).toBeNull();
    expect(resolveEl('[[invalid')).toBeNull();
    expect(resolveEl({})).toBeNull();
    expect(resolveEl(document.createTextNode('x'))).toBeNull();
    expect(
      resolveEl(() => {
        throw new Error('boom');
      }),
    ).toBeNull();
  });
});
