/**
 * grapesjs-sidebar-tools
 * ----------------------
 * GrapesJS plugin: turns the Layers panel into a split sidebar.
 *
 *   - top    -> the layer tree (unchanged)
 *   - bottom -> tabs "Style Manager" / "Component Settings", shown only
 *               while the Layers tab is open AND a component is selected
 *   - a drag handle between the two halves (double-click = 50/50)
 *
 * The real Style Manager / Trait Manager DOM is MOVED into the bottom half
 * while the Layers tab is open and moved back when you leave it (never
 * re-rendered), so their own top tabs keep working.
 *
 * Remembered in localStorage (`storageKey`): open Style Manager sectors,
 * the active bottom tab, the height split and the active GLOBAL tab
 * (top panel: styles / settings / layers / blocks).
 *
 * Commands (used by the `grapesjs-layers-context-menu` plugin):
 *   layers-sidebar:show-styles    -> bottom half on the Style Manager tab
 *   layers-sidebar:show-settings  -> bottom half on the Component Settings tab
 *
 * Usage:
 *   import grapesjsSidebarTools from 'grapesjs-sidebar-tools';
 *   grapesjs.init({ plugins: [grapesjsSidebarTools], pluginsOpts: { ... } });
 *   // or with the UMD build: plugins: [window.grapesjsSidebarTools]
 */
import plugin from './plugin';

export type {
  BottomTab,
  ElementTarget,
  SidebarState,
  SidebarToolsLabels,
  SidebarToolsOptions,
} from './types';
export type { SidebarToolsMessages } from './i18n/types';

export default plugin;
