/**
 * grapesjs-sidebar-tools
 * ----------------------
 * GrapesJS plugin: dockable tool panels.
 *
 * Every button of the views panel (Style Manager, Settings, Layers,
 * Blocks, and the views other plugins add there) becomes a tab that can
 * be dragged into one of three zones around the canvas — left, right and
 * bottom. The left and right zones can be split in two by height (drop a
 * tab on the top or bottom third of a group), zones are resized by their
 * inner edge, and the whole layout is remembered in localStorage.
 *
 * The real GrapesJS views are moved into the tabs, not re-created, and
 * their commands keep running, so several of them can be visible at once.
 *
 * Commands:
 *   sidebar-tools:show { id }      -> show a tab (id = command of its button)
 *   sidebar-tools:reset-layout     -> back to the default layout
 *   layers-sidebar:show-styles     -> show the Style Manager tab (grapesjs-context-menu)
 *   layers-sidebar:show-settings   -> show the Settings tab
 *   sidebar-tools:toggle-zone      -> collapse / expand a zone
 *   sidebar-tools:set-device / zoom -> device toolbar
 *   sidebar-tools:workspace-grid   -> split the workspace into 1–4 areas
 *
 * Workspace: a tab bar of documents above the canvas; other plugins open
 * tabs through `editor.SidebarTools.onReady(ws => ws.open({...}))`.
 *
 * Usage:
 *   import grapesjsSidebarTools from 'grapesjs-sidebar-tools';
 *   grapesjs.init({ plugins: [grapesjsSidebarTools], pluginsOpts: { ... } });
 *   // or with the UMD build: plugins: [window.grapesjsSidebarTools]
 */
import plugin from './plugin';

export type {
  DefaultLayout,
  DockLayout,
  GroupState,
  SidebarState,
  SidebarToolsLabels,
  SidebarToolsOptions,
  ZoneId,
  ZoneState,
} from './types';
export type { SidebarToolsMessages } from './i18n/types';
export type { SidebarToolsApi } from './plugin';
export type { OpenOptions, WorkspaceApi, WorkspaceDocInfo, WorkspaceDocInput } from './workspace';
export type { WsGrid, WsLayout } from './wsLayout';

export default plugin;
