export const STYLE_ELEMENT_ID = 'gjs-st-styles';

/*
 * Root = the editor element (.gjs-editor) with .gjs-st-docked and the
 * variables --gjs-st-left / --gjs-st-right / --gjs-st-bottom (px).
 *
 * The default GrapesJS layout positions the canvas and the top panels
 * with --gjs-left-width (its right sidebar) and --gjs-canvas-top; while
 * docked, the views panel and the views container are hidden and the
 * canvas / top panels are fitted between the zones instead.
 */
const L = 'var(--gjs-st-left, 0px)';
const R = 'var(--gjs-st-right, 0px)';
const B = 'var(--gjs-st-bottom, 0px)';
const TOP = 'var(--gjs-canvas-top, 40px)';

export const CSS = [
  // Layout of the core UI while docked
  '.gjs-st-docked .gjs-pn-views,.gjs-st-docked .gjs-pn-views-container{display:none !important;}',
  `.gjs-st-docked .gjs-cv-canvas{left:${L};width:calc(100% - ${L} - ${R});height:calc(100% - ${TOP} - ${B});bottom:auto;}`,
  `.gjs-st-docked .gjs-pn-commands{left:${L};width:calc(100% - ${L} - ${R});}`,
  `.gjs-st-docked .gjs-pn-options{right:${R};}`,
  `.gjs-st-docked .gjs-pn-devices-c{left:${L};}`,

  // Zones
  '.gjs-st-zone{position:absolute;z-index:4;display:flex;flex-direction:column;box-sizing:border-box;min-width:0;min-height:0;box-shadow:0 0 5px var(--gjs-main-dark-color,rgba(0,0,0,.2));}',
  `.gjs-st-zone--left{top:0;bottom:0;left:0;width:${L};}`,
  `.gjs-st-zone--right{top:0;bottom:0;right:0;width:${R};}`,
  `.gjs-st-zone--bottom{left:${L};right:${R};bottom:0;height:${B};}`,
  '.gjs-st-zone--empty{display:none;}',

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
