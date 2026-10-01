import { afterEach } from 'vitest';
import { destroyFakeEditors } from './helpers/fakeEditor';

/**
 * jsdom has no layout, so getClientRects() is always empty. The plugin
 * uses it to tell whether the layers container is displayed. Emulate
 * that: an element "has boxes" when it is connected and neither it nor
 * an ancestor is hidden with an inline display:none / [hidden].
 */
function isRendered(el: Element): boolean {
  if (!el.isConnected) return false;
  for (let node: Element | null = el; node; node = node.parentElement) {
    const html = node as HTMLElement;
    if (html.style && html.style.display === 'none') return false;
    if (html.hidden) return false;
  }
  return true;
}

Element.prototype.getClientRects = function (this: Element) {
  const list: any = isRendered(this) ? [{ top: 0, left: 0, width: 100, height: 100 }] : [];
  list.item = (i: number) => list[i] ?? null;
  return list as DOMRectList;
};

afterEach(() => {
  destroyFakeEditors();
  localStorage.clear();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});
