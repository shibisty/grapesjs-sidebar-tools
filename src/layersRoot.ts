import type { Editor } from 'grapesjs';
import { resolveEl } from './dom';
import { SPLIT_CLASS } from './splitLayout';
import type { ElementTarget } from './types';

/** Commands that render the Layer Manager into the default views panel. */
const OPEN_LAYERS_COMMANDS = ['open-layers', 'core:open-layers'];

function getLayerManager(editor: Editor): any {
  const ed = editor as any;
  return ed.LayerManager || ed.Layers || null;
}

/**
 * Container created by GrapesJS' default `open-layers` command
 * (`this.layers`, a <div> appended to the `views-container` panel).
 * Only exists after the command ran at least once.
 */
function getDefaultLayersContainer(editor: Editor): HTMLElement | null {
  const commands: any = editor.Commands;
  for (const id of OPEN_LAYERS_COMMANDS) {
    try {
      if (commands.has && !commands.has(id)) continue;
      const cmd = commands.get(id);
      const el = resolveEl(cmd && cmd.layers);
      if (el) return el;
    } catch {
      // ignore
    }
  }
  // Last resort: the parent of the rendered layer tree.
  try {
    const viewEl: HTMLElement | undefined = getLayerManager(editor)?.view?.el;
    const parent = viewEl?.parentElement;
    if (parent && !parent.closest(`.${SPLIT_CLASS}`)) return parent;
  } catch {
    // ignore
  }
  return null;
}

export interface LayersRootResult {
  el: HTMLElement | null;
  /** true when the user explicitly configured a target (worth a warning if it is missing). */
  explicit: boolean;
}

/**
 * Where the layer tree lives:
 *  1. `layersContainer` plugin option
 *  2. `layerManager.appendTo` from the editor config
 *  3. the container of the default `open-layers` command
 */
export function findLayersRoot(editor: Editor, layersContainer: ElementTarget): LayersRootResult {
  if (layersContainer) return { el: resolveEl(layersContainer), explicit: true };
  let appendTo: unknown;
  try {
    appendTo = getLayerManager(editor)?.getConfig?.()?.appendTo;
  } catch {
    appendTo = undefined;
  }
  if (appendTo) return { el: resolveEl(appendTo), explicit: true };
  return { el: getDefaultLayersContainer(editor), explicit: false };
}
