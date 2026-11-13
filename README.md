# grapesjs-sidebar-tools

[![Patreon](https://c5.patreon.com/external/logo/become_a_patron_button.png)](https://www.patreon.com/cw/shibisty)

GrapesJS plugin: **dockable tool panels**.

Every button of the GrapesJS views panel — **Style Manager**, **Settings**, **Layers**, **Blocks**, and the views other plugins add there — becomes a tab you can drag into one of three zones around the canvas:

- **left** and **right** — can be split in two by height (two tab groups one above the other, with a resizer between them);
- **bottom** — one tab group under the canvas.

So you can keep, say, Layers on the left, Styles on the right and the component Settings at the bottom — all visible at once.

- Drag a tab by its icon. While dragging, empty zones show a "Drop here" strip, and a blue indicator shows where the tab will land:
  - on a **tab bar** — the tab joins that group at that position;
  - on the **upper / lower third** of a side group — the zone is split and the tab gets a group of its own above / below;
  - anywhere else in a group — the tab joins that group.
- A group that loses its last tab disappears; a zone without groups collapses and gives its room back to the canvas.
- Drag the inner edge of a zone to resize it (double-click: default size); drag the bar between two groups to change their heights (double-click: 50/50). The canvas never gets narrower than 320 px.
- `Esc` cancels a drag. Tabs work with the keyboard too (`Enter`, `←` / `→`).
- Every zone has a **collapse** button (the chevron at the outer end of its tab bar): a collapsed zone shrinks to a rail with the tab icons — click an icon (or drop a tab on the rail) to expand it again.
- The layout (tabs, groups, sizes) and the open Style Manager sectors are remembered in `localStorage`.

The real GrapesJS views are **moved** into the tabs, not re-created, and their commands keep running — that is what lets several of them be visible at the same time. Code that opens a view the usual way (a click on its button, `editor.runCommand('open-layers')`, `grapesjs-preset-webpage` opening the Style Manager on select) simply brings its tab to the front.

Works with the default GrapesJS UI (the `views` panel and the `views-container`), e.g. `grapesjs-preset-webpage`.

## Device toolbar

A toolbar above the canvas, like "Toggle device toolbar" in the browser dev tools:

- one button per device of the Device Manager (icons for desktop / tablet / mobile) and **Responsive** — a free-size device;
- **width × height** of the frame: type a size to switch to Responsive with that size (empty height = as high as the canvas), ↻ swaps width and height. While Responsive, styles are edited for the media query that applies at that width (e.g. 600 px edits the `max-width: 767px` styles of the mobile device);
- **zoom**: *Fit* (default — the device always fits into the canvas) or a fixed level, `−` / `+`, and `Ctrl` / `⌘` + mouse wheel over the canvas. The zoomed page fills the canvas, so *Desktop* at 50% on a 960 px wide canvas shows the page as on a 1920 px screen.

It uses GrapesJS' own canvas zoom, so selection, the toolbar and drag & drop keep working. Device, responsive size and zoom are remembered. The GrapesJS devices panel (the Desktop / Tablet / Mobile buttons of the top bar) is hidden while the toolbar is shown (`hideDevicePanel: false` keeps it).

The `set-device-desktop` / `set-device-tablet` / `set-device-mobile` commands of `grapesjs-preset-webpage` select devices by fixed names (`'Mobile portrait'`), which often don't exist in your `deviceManager` config — then the buttons do nothing. The plugin replaces them with commands that find the device by kind (id / name, else by width), `fixDeviceCommands: false` turns that off.

## Workspace: document tabs and split view

Between the zones, under the top bar, there is a **tab bar of documents**. Out of the box it holds one tab — the canvas (titled after the current page). Other plugins open their documents there:

- [grapesjs-pages](https://www.npmjs.com/package/grapesjs-pages) — one tab per opened page: clicking a tab switches the page, `×` closes the tab only (the page stays);
- [grapesjs-scripts](https://www.npmjs.com/package/grapesjs-scripts) — the blueprint editor opens in a tab instead of covering the whole editor.

Tabs are switched by a click (or `Enter`), closed by `×`, a middle click or `Delete`, reordered and moved between areas by dragging.

The **layout button** (at the right end of the tab bar) splits the workspace into one area, two columns, two rows, three columns or 2 × 2 — handy on 4K screens: e.g. the page in one area and its script graph next to it. Areas are resized by the bars between them (double-click: equal sizes). There is one GrapesJS canvas, so all canvas documents (pages) live in the same area; the canvas follows that area when it is moved or resized. The grid, sizes and open tabs are remembered and restored after a reload.

`workspace: false` turns the tab bar off (the canvas takes the whole space between the zones, like in 2.1).

### API for plugins

```js
editor.SidebarTools?.onReady((ws) => {
  // an element document: your own UI in the tab
  ws.open({
    id: 'my-plugin:report',
    title: 'Report',
    icon: '<svg>…</svg>',
    mount: (container) => renderReport(container), // once, when first shown
    onShow: () => {},                                 // every time it becomes visible
    onClose: () => confirm('Close?'),                 // return false to keep it open
    onClosed: () => {},
  });
  // a canvas document: shown in the GrapesJS canvas
  ws.open({ id: 'my-plugin:page-2', title: 'Page 2', kind: 'canvas', onActivate: () => loadIntoCanvas() });
});
// or: editor.on('sidebar-tools:ready', ({ workspace }) => …)
```

| Method | Description |
| --- | --- |
| `open(doc, { activate = true, notify = true, group })` | Open a tab (or show it when it is open). `notify: false` — don't call `onActivate` (the canvas already shows it). |
| `update(id, { title, icon, tooltip, dirty, closable })` | Change a tab. `dirty` marks unsaved changes. |
| `activate(id, { notify })` / `close(id, { force, notify })` | Show / close a tab. `close` returns whether it closed. |
| `has(id)` / `list()` / `canvasDoc()` | Open tabs, `[{ id, kind, title, group, active }]`, the canvas document now in the canvas. |
| `remembered(prefix)` | Ids with this prefix that were open before the reload and are not open yet — open them again to restore the tabs. |
| `getGrid()` / `setGrid('1' \| '2h' \| '2v' \| '3h' \| '4')` | The split of the workspace. |

Use ids prefixed with your plugin name. Ids of documents that are not opened again within a few seconds after load are forgotten.

## Install

```sh
npm i grapesjs-sidebar-tools
```

```js
import grapesjs from 'grapesjs';
import sidebarTools from 'grapesjs-sidebar-tools';

grapesjs.init({
  container: '#gjs',
  plugins: [sidebarTools],
  pluginsOpts: {
    [sidebarTools]: {
      // optional: where the tabs are until the user moves them
      defaultLayout: {
        left: [['open-layers'], ['open-blocks']],
        right: [['open-sm', 'open-tm']],
      },
    },
  },
});
```

### Without a bundler

```html
<script src="https://unpkg.com/grapesjs"></script>
<script src="https://unpkg.com/grapesjs-sidebar-tools"></script>
<script>
  grapesjs.init({
    container: '#gjs',
    // the UMD build exposes the plugin function as window.grapesjsSidebarTools
    plugins: [grapesjsSidebarTools],
    pluginsOpts: {
      [grapesjsSidebarTools]: { /* options */ },
    },
  });
</script>
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `defaultLayout` | `{}` | Initial placement: groups of tab ids per zone, e.g. `{ left: [['open-layers'], ['open-blocks']], bottom: [['open-tm']] }`. A tab id is the command of its button (`open-sm`, `open-tm`, `open-layers`, `open-blocks`, ...). Tabs not listed go to the right zone. Used until the user changes the layout (or after `sidebar-tools:reset-layout`). |
| `sizes` | `{ left: 260, right: null, bottom: 240 }` | Default zone sizes in px. `right: null` = 15% of the editor width, like the GrapesJS sidebar. |
| `minSize` | `{ side: 180, bottom: 120 }` | Minimum width of the side zones / height of the bottom zone. |
| `minRatio` / `maxRatio` | `0.15` / `0.85` | Bounds of the upper group height in a split zone. |
| `views` | `null` | Only dock these buttons (ids or command ids). Default: every button of the views panel whose command shows something in the views container. |
| `panelId` | `null` | Id of the views panel. Default: auto-detected by its buttons (`views` in the default UI). |
| `persist` | `true` | Remember the layout and the open Style Manager sectors in `localStorage`. |
| `storageKey` | `'gjs-sidebar-tools'` | `localStorage` key. |
| `injectCss` | `true` | Inject the plugin stylesheet. Turn off to ship your own CSS (see the `.gjs-st-*` classes). |
| `stylesTab` / `settingsTab` | `'open-sm'` / `'open-tm'` | Tabs opened by the `layers-sidebar:show-styles` / `layers-sidebar:show-settings` commands. |
| `deviceBar` | `true` | Show the device toolbar. |
| `zoomLevels` | `[25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200]` | Zoom levels of the toolbar, percent. |
| `hideDevicePanel` | `true` | Hide the GrapesJS devices panel while the toolbar is shown. |
| `fixDeviceCommands` | `true` | Make the `set-device-*` commands of grapesjs-preset-webpage find devices by kind. |
| `workspace` | `true` | Show the document tab bar / split workspace (see [Workspace](#workspace-document-tabs-and-split-view)). |
| `labels` | `{}` | Fixed texts that override the translations (any key of the table in [Localization](#localization)). |

## Commands and events

| Command | Description |
| --- | --- |
| `sidebar-tools:show` | `editor.runCommand('sidebar-tools:show', { id: 'open-layers' })` — bring a tab to the front of its group. |
| `sidebar-tools:reset-layout` | Put every tab back to `defaultLayout`. |
| `sidebar-tools:toggle-zone` | `{ zone: 'left' \| 'right' \| 'bottom', collapsed?: boolean }` — collapse / expand a zone (toggle without `collapsed`). |
| `sidebar-tools:set-device` | `{ id }` or `{ kind: 'desktop' \| 'tablet' \| 'mobile' }`. |
| `sidebar-tools:zoom` | `{ value: 'fit' \| 'in' \| 'out' \| 50 }`. |
| `sidebar-tools:workspace-grid` | `{ grid: '1' \| '2h' \| '2v' \| '3h' \| '4' }` — split the workspace. |
| `layers-sidebar:show-styles` | Show the Style Manager tab (kept from 1.x, used by `grapesjs-context-menu`). |
| `layers-sidebar:show-settings` | Show the Settings tab. |

The `sidebar-tools:layout` event fires with `{ layout, reason }` after every change made by the user (`reason`: `move`, `activate`, `size`, `ratio`, `collapse`, `set`).

`sidebar-tools:ready` fires once with `{ workspace }` when the workspace exists; `sidebar-tools:workspace` fires with `{ type: 'open' | 'close' | 'activate' | 'layout', id? }` on workspace changes.

## Views from other plugins

A plugin's view is docked automatically when its button is in the views panel and its command shows content in the views container (`panel.set('appendContent', el)`, or an element it un-hides there) — `grapesjs-pages` works this way. Buttons added later (after the editor loaded) are docked as they appear. Buttons whose command renders somewhere else are left alone.

What the plugin does with a view:

1. gives its button a `context` of its own, so activating one view no longer deactivates (stops) the others;
2. runs its command once with a sender that reports `active: true` and moves what appeared in the views container into the tab;
3. when anything stops the command later, runs it again right away, so the content never disappears from its tab;
4. when anything runs it (button, `runCommand`), shows its tab and puts the button back to idle.

## Localization

The plugin's own texts (tooltips, "Drop here", the device toolbar) are translated into the **22 languages GrapesJS itself ships** (`grapesjs/locale`: ar, bs, ca, de, el, en, es, fa, fr, he, id, it, ko, nb, nl, pl, pt, ru, se, tr, vi, zh) — see `src/i18n/locales/`. Tabs show the icon and the title of the original GrapesJS buttons.

Nothing needs to be configured. The plugin registers its catalog with `editor.I18n` under the `sidebarTools` key and follows the editor locale: the browser language by default (`i18n.detectLocale`) or an explicit `i18n.locale`, falling back to English (`localeFallback`). Locale changes at runtime (`editor.I18n.setLocale('de')`) are applied immediately.

Override single strings for a language through GrapesJS:

```js
editor.I18n.addMessages({
  en: { sidebarTools: { dropHere: 'Put it here' } },
});
```

or fix them for every language with the `labels` option (it always wins over the translations).

| Key | English |
| --- | --- |
| `sidebarTools.resizerTitle` | Drag to resize (double-click to reset to 50/50) |
| `sidebarTools.zoneResizerTitle` | Drag to resize the panel (double-click to reset) |
| `sidebarTools.dropHere` | Drop here |
| `sidebarTools.collapse` / `expand` | Collapse panel / Expand panel |
| `sidebarTools.device` | Device |
| `sidebarTools.responsive` | Responsive |
| `sidebarTools.width` / `height` | Width / Height |
| `sidebarTools.rotate` | Rotate |
| `sidebarTools.zoom` / `zoomFit` / `zoomIn` / `zoomOut` | Zoom / Fit / Zoom in / Zoom out |
| `sidebarTools.auto` | auto (placeholder of an empty height) |
| `sidebarTools.canvas` | Canvas (title of the canvas tab when there is no page name) |
| `sidebarTools.closeTab` | Close |
| `sidebarTools.splitLayout` | Split the workspace |
| `sidebarTools.layoutSingle` / `layoutColumns2` / `layoutRows2` / `layoutColumns3` / `layoutGrid4` | One area / Two columns / Two rows / Three columns / Four areas (2 × 2) |

## Upgrading from 1.x

- The split Layers panel (Style Manager / Settings under the layer tree) is gone: put the Styles tab under Layers with a drag instead (drop it on the lower third of the Layers group).
- The `layers-sidebar:show-styles` / `layers-sidebar:show-settings` commands still work and bring the tab to the front wherever it is.
- Removed options: `layersContainer`, `prerenderManagers`, `globalTabCommands`, `restoreGlobalTab`; removed labels: `styleManagerTab`, `settingsTab`. The state is stored under a new key (`gjs-sidebar-tools`).

## Development

```sh
npm install
npm run dev        # vite dev server
npm test           # vitest (jsdom, with a real GrapesJS editor)
npm run typecheck  # tsc for src and tests
npm run build      # dist/: ES module, UMD, .d.ts
```

`npm publish` runs a package.json check, typecheck, tests and build first (`prepublishOnly`).

## License

MIT
