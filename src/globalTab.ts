import type { Editor } from 'grapesjs';

/**
 * Remembers the last "global" (top panel) tab command and re-activates it
 * after a reload.
 */

/**
 * A "view" button is a panel button whose command is the string `cmdId`.
 * GrapesJS default panels don't set `togglable: false` on them (they are
 * grouped with `context`), so that is not required.
 */
export function findViewButton(editor: Editor, cmdId: string): any {
  let found: any = null;
  try {
    const panels: any = editor.Panels.getPanels();
    panels.forEach((panel: any) => {
      const buttons = panel.get('buttons');
      buttons &&
        buttons.forEach((btn: any) => {
          if (!found && btn.get('command') === cmdId) found = btn;
        });
    });
  } catch {
    // no panels module / custom UI
  }
  return found;
}

export interface GlobalTabMemory {
  /** Handler for the editor's `run` event. */
  onRun(id: unknown): void;
  /** Re-activates the remembered tab, then starts recording. */
  restore(): void;
  destroy(): void;
}

export interface GlobalTabMemoryOptions {
  commands: string[];
  restore: boolean;
  get(): string | null;
  set(id: string): void;
  /** Delay before recording starts (lets the editor's own initial runs pass). */
  recordDelay?: number;
}

export function createGlobalTabMemory(editor: Editor, opts: GlobalTabMemoryOptions): GlobalTabMemory {
  // Stays off until the saved tab was restored, so the editor's own
  // initial "open-sm" run can't overwrite the remembered tab.
  let recording = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const isGlobalTab = (id: unknown): id is string => typeof id === 'string' && opts.commands.indexOf(id) !== -1;

  return {
    onRun(id) {
      if (recording && isGlobalTab(id)) opts.set(id);
    },
    restore() {
      const id = opts.get();
      if (opts.restore && isGlobalTab(id)) {
        const btn = findViewButton(editor, id);
        // Only ever go through the real panel button: it deactivates the
        // other buttons of the group and runs the command with the right
        // `sender`. Running the bare command can leave the top panel in a
        // broken state, so without a button we do nothing.
        if (btn && !btn.get('active')) btn.set('active', true);
      }
      timer = setTimeout(() => {
        timer = null;
        recording = true;
      }, opts.recordDelay ?? 100);
    },
    destroy() {
      if (timer) clearTimeout(timer);
      timer = null;
      recording = false;
    },
  };
}
