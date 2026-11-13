import grapesjs, { type Editor } from 'grapesjs';
import plugin from '../../src/index';
import type { SidebarToolsOptions } from '../../src/types';

export const SAMPLE_HTML = '<section id="sec"><h1 id="title">Title</h1><p id="p1">One</p></section>';

export const flush = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * A real GrapesJS editor in jsdom with its DEFAULT panels (views panel with
 * Styles / Settings / Layers / Blocks), like a page without a custom UI.
 * Resolves once the dock was built (one tick after load).
 */
export async function createEditor(
  opts: SidebarToolsOptions = {},
  extraPlugins: Array<(ed: Editor) => void> = [],
): Promise<Editor> {
  const container = document.createElement('div');
  container.id = 'gjs';
  document.body.appendChild(container);
  const editor = grapesjs.init({
    container,
    height: '600px',
    storageManager: false,
    telemetry: false,
    components: SAMPLE_HTML,
    plugins: [(ed: Editor) => plugin(ed, opts), ...extraPlugins],
  } as Parameters<typeof grapesjs.init>[0]);
  await new Promise<void>((resolve) => editor.onReady(() => resolve()));
  await flush(5);
  return editor;
}

export async function destroyEditor(editor: Editor | undefined): Promise<void> {
  if (!editor) return;
  // Let GrapesJS' own debounced handlers run before the teardown.
  await flush(10);
  try {
    editor.trigger('destroy');
    editor.destroy();
  } catch {
    // already gone
  }
}

export const root = (editor: Editor) => (editor as any).getEl() as HTMLElement;

/** Tabs per zone/group as 'id*' (active) strings. */
export function tabsOf(editor: Editor) {
  const out: Record<string, string[][]> = {};
  root(editor)
    .querySelectorAll<HTMLElement>('.gjs-st-zone')
    .forEach((z) => {
      out[z.dataset.zone!] = Array.from(z.querySelectorAll(':scope > .gjs-st-group')).map((g) =>
        Array.from(g.querySelectorAll<HTMLElement>('.gjs-st-tab')).map(
          (t) => t.dataset.tab! + (t.classList.contains('gjs-st-tab--active') ? '*' : ''),
        ),
      );
    });
  return out;
}

export const pane = (editor: Editor, id: string) =>
  root(editor).querySelector<HTMLElement>(`.gjs-st-pane[data-tab="${id}"]`)!;

export const tab = (editor: Editor, id: string) =>
  root(editor).querySelector<HTMLElement>(`.gjs-st-tab[data-tab="${id}"]`)!;

/** A click as the dock sees it: pointerdown + pointerup without moving. */
export function clickTab(editor: Editor, id: string) {
  const el = tab(editor, id);
  const opts = { bubbles: true, cancelable: true, button: 0, clientX: 5, clientY: 5 };
  el.dispatchEvent(Object.assign(new MouseEvent('pointerdown', opts), { pointerId: 1 }));
  document.dispatchEvent(Object.assign(new MouseEvent('pointerup', opts), { pointerId: 1 }));
}
