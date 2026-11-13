export const STYLE_ELEMENT_ID = 'gjs-st-styles';

/*
 * Root = the editor element (.gjs-editor) with .gjs-st-docked and the
 * variables --gjs-st-left / --gjs-st-right / --gjs-st-bottom (px).
 *
 * The default GrapesJS layout positions the canvas and the top panels
 * with --gjs-left-width (its right sidebar) and --gjs-canvas-top; while
 * docked, the views panel and the views container are hidden and the
 * canvas / top panels are fitted between the zones instead.
 *
 * The device toolbar (.gjs-st-devbar-on, --gjs-st-devbar = its height)
 * sits between the top bar and the canvas; zoom (.gjs-st-zoomed,
 * --gjs-st-zoom) makes the scaled frames area fill the canvas.
 */
const L = 'var(--gjs-st-left, 0px)';
const R = 'var(--gjs-st-right, 0px)';
const B = 'var(--gjs-st-bottom, 0px)';
const TOP = 'var(--gjs-canvas-top, 40px)';
const DEVBAR = 'var(--gjs-st-devbar, 0px)';
/** Right edge of the canvas area: the right zone when docked, else the GrapesJS sidebar. */
const R_ANY = 'var(--gjs-st-right, var(--gjs-left-width, 15%))';
/** Workspace tab strip height. */
const WS_TABS = '32px';
/** Canvas rect measured by the workspace (falls back to the whole area under the tab strip). */
const CV_X = `var(--gjs-st-cv-x, ${L})`;
const CV_Y = `var(--gjs-st-cv-y, calc(${TOP} + ${WS_TABS}))`;
const CV_W = `var(--gjs-st-cv-w, calc(100% - ${L} - ${R_ANY}))`;
const CV_H = `var(--gjs-st-cv-h, calc(100% - ${TOP} - ${WS_TABS} - ${B}))`;

export const CSS = [
  // Layout of the core UI while docked
  '.gjs-st-docked .gjs-pn-views,.gjs-st-docked .gjs-pn-views-container{display:none !important;}',
  `.gjs-st-docked .gjs-cv-canvas{left:${L};width:calc(100% - ${L} - ${R});bottom:auto;}`,
  `.gjs-st-docked .gjs-cv-canvas,.gjs-st-devbar-on .gjs-cv-canvas{top:calc(${TOP} + ${DEVBAR});height:calc(100% - ${TOP} - ${DEVBAR} - ${B});bottom:auto;}`,
  `.gjs-st-docked .gjs-pn-commands{left:${L};width:calc(100% - ${L} - ${R});}`,
  `.gjs-st-docked .gjs-pn-options{right:${R};}`,
  `.gjs-st-docked .gjs-pn-devices-c{left:${L};}`,

  // Device toolbar
  `.gjs-st-devbar{position:absolute;z-index:3;top:${TOP};left:${L};right:${R_ANY};height:${DEVBAR};box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 8px;font-size:12px;border-bottom:1px solid var(--gjs-main-dark-color,rgba(0,0,0,.2));overflow:hidden;white-space:nowrap;}`,
  '.gjs-st-devbar__devices{display:inline-flex;gap:2px;}',
  '.gjs-st-devbar__btn{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;padding:0 4px;border:0;border-radius:3px;background:transparent;color:inherit;cursor:pointer;font:inherit;}',
  '.gjs-st-devbar__btn:hover:not(:disabled){background:var(--gjs-main-light-color,rgba(255,255,255,.1));}',
  '.gjs-st-devbar__btn:disabled{opacity:.35;cursor:default;}',
  '.gjs-st-devbar__btn--active{background:var(--gjs-main-dark-color,rgba(0,0,0,.2));}',
  '.gjs-st-devbar__size{display:inline-flex;align-items:center;gap:4px;}',
  '.gjs-st-devbar input,.gjs-st-devbar select{box-sizing:border-box;height:24px;padding:0 4px;border:1px solid var(--gjs-main-dark-color,rgba(0,0,0,.2));border-radius:2px;background:var(--gjs-main-dark-color,rgba(0,0,0,.2));color:inherit;font:inherit;}',
  '.gjs-st-devbar input{width:62px;text-align:center;-moz-appearance:textfield;}',
  '.gjs-st-devbar input::-webkit-outer-spin-button,.gjs-st-devbar input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}',
  '.gjs-st-devbar select option{color:#222;background:#fff;}',
  '.gjs-st-devbar__sep{width:1px;height:18px;margin:0 4px;background:var(--gjs-main-light-color,rgba(255,255,255,.1));}',
  '.gjs-st-devbar-on.gjs-st-hide-devices .gjs-pn-devices-c{display:none !important;}',
  // Zoom: GrapesJS scales the frames area around its centre; scale from the
  // top-left corner and make it 1/zoom as large, so it fills the canvas.
  '.gjs-st-zoomed .gjs-cv-canvas__frames{transform-origin:0 0 !important;width:calc(100% / var(--gjs-st-zoom, 1)) !important;height:calc(100% / var(--gjs-st-zoom, 1)) !important;}',

  // Workspace: document tabs in 1–4 groups; the canvas is placed over its group
  `.gjs-st-ws{position:absolute;z-index:0;left:${L};right:${R_ANY};top:${TOP};bottom:${B};display:flex;flex-direction:column;min-width:0;min-height:0;box-sizing:border-box;}`,
  '.gjs-st-wsg-row{display:flex;flex:1 1 0;min-height:0;min-width:0;}',
  '.gjs-st-wsg{display:flex;flex-direction:column;min-width:0;min-height:0;}',
  `.gjs-st-wsg__tabs{display:flex;align-items:stretch;flex:0 0 ${WS_TABS};height:${WS_TABS};box-sizing:border-box;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;border-bottom:1px solid var(--gjs-main-dark-color,rgba(0,0,0,.2));}`,
  '.gjs-st-wtab{display:flex;align-items:center;gap:6px;flex:0 0 auto;max-width:220px;min-width:0;padding:0 6px 0 10px;box-sizing:border-box;cursor:pointer;user-select:none;touch-action:none;font-size:12px;white-space:nowrap;opacity:.7;border-right:1px solid var(--gjs-main-dark-color,rgba(0,0,0,.2));}',
  '.gjs-st-wtab:hover{opacity:.9;}',
  '.gjs-st-wtab--active{opacity:1;background:var(--gjs-main-light-color,rgba(255,255,255,.1));box-shadow:inset 0 -2px 0 var(--gjs-color-blue,#3b97e3);}',
  '.gjs-st-wtab:focus-visible{outline:1px solid var(--gjs-color-blue,#3b97e3);outline-offset:-1px;}',
  '.gjs-st-wtab__icon{display:inline-flex;align-items:center;flex:0 0 auto;}',
  '.gjs-st-wtab__icon svg{width:14px;height:14px;}',
  '.gjs-st-wtab__title{overflow:hidden;text-overflow:ellipsis;min-width:0;}',
  ".gjs-st-wtab--dirty .gjs-st-wtab__title::after{content:' \\2022';}",
  '.gjs-st-wtab__close{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:2px;opacity:.6;}',
  '.gjs-st-wtab__close:hover{opacity:1;background:var(--gjs-main-dark-color,rgba(0,0,0,.2));}',
  '.gjs-st-wsg__layout{display:inline-flex;align-items:center;margin-left:auto;padding:0 8px;cursor:pointer;opacity:.7;flex:0 0 auto;}',
  '.gjs-st-wsg__layout:hover,.gjs-st-wsg__layout:focus-visible{opacity:1;}',
  '.gjs-st-wsg__body{position:relative;flex:1 1 auto;min-height:0;min-width:0;}',
  '.gjs-st-doc{position:absolute;top:0;right:0;bottom:0;left:0;overflow:hidden;}',
  '.gjs-st-doc[hidden],.gjs-st-ws-stash{display:none !important;}',
  '.gjs-st-wsg__empty{position:absolute;top:8px;right:8px;bottom:8px;left:8px;display:flex;align-items:center;justify-content:center;border:1px dashed var(--gjs-main-light-color,rgba(255,255,255,.15));border-radius:3px;font-size:12px;opacity:.7;}',
  '.gjs-st-wsg-colsplit{flex:0 0 4px;cursor:col-resize;touch-action:none;background:var(--gjs-main-dark-color,rgba(0,0,0,.2));}',
  '.gjs-st-wsg-rowsplit{flex:0 0 4px;cursor:row-resize;touch-action:none;background:var(--gjs-main-dark-color,rgba(0,0,0,.2));}',
  '.gjs-st-wsg-colsplit:hover,.gjs-st-wsg-rowsplit:hover{background:var(--gjs-color-blue,#3b97e3);}',
  '.gjs-st-wsmenu{position:absolute;z-index:20;display:flex;flex-direction:column;gap:2px;padding:4px;border-radius:3px;box-shadow:0 2px 10px rgba(0,0,0,.4);font-size:12px;}',
  '.gjs-st-wsmenu__item{display:flex;align-items:center;gap:10px;padding:6px 10px;border:0;border-radius:2px;background:transparent;color:inherit;font:inherit;text-align:left;white-space:nowrap;cursor:pointer;}',
  '.gjs-st-wsmenu__item:hover,.gjs-st-wsmenu__item:focus-visible{background:var(--gjs-main-light-color,rgba(255,255,255,.1));outline:none;}',
  `.gjs-st-ws-on .gjs-cv-canvas{left:${CV_X};top:calc(${CV_Y} + ${DEVBAR});width:${CV_W};height:calc(${CV_H} - ${DEVBAR});bottom:auto;}`,
  `.gjs-st-ws-on .gjs-st-devbar{left:${CV_X};top:${CV_Y};width:${CV_W};right:auto;}`,
  '.gjs-st-canvas-off .gjs-cv-canvas,.gjs-st-canvas-off .gjs-st-devbar{visibility:hidden !important;pointer-events:none !important;}',
  '.gjs-st-ws-dragging,.gjs-st-ws-dragging *{cursor:grabbing !important;user-select:none !important;}',
  '.gjs-st-ws-dragging .gjs-cv-canvas{pointer-events:none;}',

  // Zones
  '.gjs-st-zone{position:absolute;z-index:4;display:flex;flex-direction:column;box-sizing:border-box;min-width:0;min-height:0;box-shadow:0 0 5px var(--gjs-main-dark-color,rgba(0,0,0,.2));}',
  `.gjs-st-zone--left{top:0;bottom:0;left:0;width:${L};}`,
  `.gjs-st-zone--right{top:0;bottom:0;right:0;width:${R};}`,
  `.gjs-st-zone--bottom{left:${L};right:${R};bottom:0;height:${B};}`,
  '.gjs-st-zone--empty{display:none;}',
  // Collapse button (first tab bar) and the rail of a collapsed zone
  '.gjs-st-collapse{display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:.7;}',
  '.gjs-st-collapse:hover{opacity:1;}',
  '.gjs-st-zone--left .gjs-st-collapse{margin-left:auto;}',
  '.gjs-st-zone--right .gjs-st-collapse{margin-right:auto;transform:rotate(180deg);}',
  '.gjs-st-zone--bottom .gjs-st-collapse{margin-left:auto;transform:rotate(-90deg);}',
  '.gjs-st-zone--left .gjs-st-collapse--expand{margin:0;transform:rotate(180deg);}',
  '.gjs-st-zone--right .gjs-st-collapse--expand{margin:0;transform:none;}',
  '.gjs-st-zone--bottom .gjs-st-collapse--expand{margin:0;transform:rotate(90deg);}',
  '.gjs-st-rail{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px;padding:5px 0;flex:1 1 auto;min-height:0;overflow:hidden;}',
  '.gjs-st-zone--bottom .gjs-st-rail{flex-direction:row;padding:0 5px;}',
  '.gjs-st-stash{display:none !important;}',

  // Groups (a side zone split in two: first group takes --gjs-st-ratio)
  '.gjs-st-group{display:flex;flex-direction:column;flex:1 1 0;min-height:0;min-width:0;}',
  '.gjs-st-zone--split>.gjs-st-group--first{flex:0 0 var(--gjs-st-ratio,50%);}',
  '.gjs-st-tabs{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:2px;flex:0 0 auto;box-sizing:border-box;min-height:40px;padding:5px;border-bottom:2px solid var(--gjs-main-dark-color,rgba(0,0,0,.2));text-align:center;}',
  '.gjs-st-zone--left .gjs-st-tabs{justify-content:flex-start;}',
  '.gjs-st-zone--bottom .gjs-st-tabs{justify-content:flex-start;}',
  '.gjs-st-tab{cursor:pointer;touch-action:none;user-select:none;margin:0;}',
  '.gjs-st-tab:focus-visible{outline:1px solid var(--gjs-color-blue,#3b97e3);outline-offset:1px;}',
  '.gjs-st-body{position:relative;flex:1 1 auto;min-height:0;}',
  '.gjs-st-pane{position:absolute;top:0;right:0;bottom:0;left:0;overflow:auto;text-align:left;}',
  '.gjs-st-pane[hidden]{display:none !important;}',

  // Resizers: between the two groups of a side zone, and the inner edge of every zone
  '.gjs-st-split{flex:0 0 6px;cursor:row-resize;background:rgba(255,255,255,.08);touch-action:none;}',
  '.gjs-st-split:hover,.gjs-st-resizing .gjs-st-split:hover{background:var(--gjs-color-blue,#3b97e3);}',
  '.gjs-st-edge{position:absolute;z-index:2;touch-action:none;}',
  '.gjs-st-edge:hover{background:var(--gjs-color-blue,#3b97e3);}',
  '.gjs-st-edge--left{top:0;bottom:0;right:-3px;width:6px;cursor:col-resize;}',
  '.gjs-st-edge--right{top:0;bottom:0;left:-3px;width:6px;cursor:col-resize;}',
  '.gjs-st-edge--bottom{left:0;right:0;top:-3px;height:6px;cursor:row-resize;}',
  '.gjs-st-resizing,.gjs-st-resizing *{user-select:none !important;}',
  '.gjs-st-resizing .gjs-cv-canvas,.gjs-st-dragging .gjs-cv-canvas{pointer-events:none;}',

  // Drag & drop
  '.gjs-st-drop{display:none;position:absolute;z-index:5;box-sizing:border-box;align-items:center;justify-content:center;border:2px dashed var(--gjs-color-blue,#3b97e3);background:rgba(59,151,227,.12);color:var(--gjs-font-color,#ddd);font-size:11px;pointer-events:none;}',
  `.gjs-st-drop--left{top:${TOP};bottom:${B};left:${L};width:56px;}`,
  `.gjs-st-drop--right{top:${TOP};bottom:${B};right:${R};width:56px;}`,
  `.gjs-st-drop--bottom{left:${L};right:${R};bottom:0;height:56px;}`,
  '.gjs-st-drop--left .gjs-st-drop__label,.gjs-st-drop--right .gjs-st-drop__label{writing-mode:vertical-rl;}',
  '.gjs-st-dragging .gjs-st-zone--empty+.gjs-st-drop{display:flex;}',
  '.gjs-st-dragging,.gjs-st-dragging *{cursor:grabbing !important;user-select:none !important;}',
  '.gjs-st-ghost{position:fixed !important;z-index:10000;pointer-events:none;opacity:.85;margin:0;color:var(--gjs-font-color,#ddd);background:var(--gjs-primary-color,#444);border-radius:2px;box-shadow:0 2px 8px rgba(0,0,0,.4);}',
  '.gjs-st-indicator{position:fixed;z-index:9999;pointer-events:none;box-sizing:border-box;border:2px solid var(--gjs-color-blue,#3b97e3);background:rgba(59,151,227,.18);}',
  '.gjs-st-indicator--line{border:0;background:var(--gjs-color-blue,#3b97e3);}',
  '.gjs-st-indicator[hidden]{display:none !important;}',
].join('');

/** Adds the plugin stylesheet once per document. */
export function injectCss(doc: Document = document): void {
  if (doc.getElementById(STYLE_ELEMENT_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}
