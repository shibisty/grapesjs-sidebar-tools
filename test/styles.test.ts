import { describe, expect, it } from 'vitest';
import { CSS, injectCss, STYLE_ELEMENT_ID } from '../src/styles';

describe('injectCss', () => {
  it('adds the stylesheet only once', () => {
    injectCss();
    injectCss();
    const styles = document.head.querySelectorAll(`#${STYLE_ELEMENT_ID}`);
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toBe(CSS);
  });
});

describe('CSS', () => {
  it('hides the core views panel and container while docked', () => {
    expect(CSS).toContain('.gjs-st-docked .gjs-pn-views,.gjs-st-docked .gjs-pn-views-container{display:none !important;}');
  });

  it('fits the canvas and the top panels between the zones and under the device toolbar', () => {
    expect(CSS).toContain('.gjs-st-docked .gjs-cv-canvas{left:var(--gjs-st-left, 0px);width:calc(100% - var(--gjs-st-left, 0px) - var(--gjs-st-right, 0px));bottom:auto;}');
    expect(CSS).toContain(
      '.gjs-st-docked .gjs-cv-canvas,.gjs-st-devbar-on .gjs-cv-canvas{top:calc(var(--gjs-canvas-top, 40px) + var(--gjs-st-devbar, 0px));height:calc(100% - var(--gjs-canvas-top, 40px) - var(--gjs-st-devbar, 0px) - var(--gjs-st-bottom, 0px));bottom:auto;}',
    );
    expect(CSS).toContain('.gjs-st-docked .gjs-pn-commands{left:var(--gjs-st-left, 0px);');
    expect(CSS).toContain('.gjs-st-docked .gjs-pn-options{right:var(--gjs-st-right, 0px);}');
  });

  it('scales the zoomed frames area from its top-left corner to fill the canvas', () => {
    expect(CSS).toContain(
      '.gjs-st-zoomed .gjs-cv-canvas__frames{transform-origin:0 0 !important;width:calc(100% / var(--gjs-st-zoom, 1)) !important;height:calc(100% / var(--gjs-st-zoom, 1)) !important;}',
    );
  });

  it('places the device toolbar above the canvas, between the zones (or left of the GrapesJS sidebar)', () => {
    expect(CSS).toMatch(/\.gjs-st-devbar\{position:absolute;z-index:3;top:var\(--gjs-canvas-top, 40px\);left:var\(--gjs-st-left, 0px\);right:var\(--gjs-st-right, var\(--gjs-left-width, 15%\)\);height:var\(--gjs-st-devbar, 0px\);/);
    expect(CSS).toContain('.gjs-st-devbar-on.gjs-st-hide-devices .gjs-pn-devices-c{display:none !important;}');
  });

  it('stacks the rail icons from the start (GrapesJS spreads .gjs-pn-buttons)', () => {
    expect(CSS).toMatch(/\.gjs-st-rail\{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;/);
    expect(CSS).toContain('.gjs-st-stash{display:none !important;}');
  });

  it('keeps hidden panes and empty zones hidden', () => {
    expect(CSS).toContain('.gjs-st-pane[hidden]{display:none !important;}');
    expect(CSS).toContain('.gjs-st-zone--empty{display:none;}');
  });

  it('shows the drop strip of an empty zone only while dragging', () => {
    expect(CSS).toMatch(/\.gjs-st-drop\{display:none;/);
    expect(CSS).toContain('.gjs-st-dragging .gjs-st-zone--empty+.gjs-st-drop{display:flex;}');
  });

  it('uses the split ratio only for the first group of a split zone', () => {
    expect(CSS).toContain('.gjs-st-zone--split>.gjs-st-group--first{flex:0 0 var(--gjs-st-ratio,50%);}');
  });

  it('keeps the canvas iframe from swallowing pointer events during a drag or resize', () => {
    expect(CSS).toContain('.gjs-st-resizing .gjs-cv-canvas,.gjs-st-dragging .gjs-cv-canvas{pointer-events:none;}');
  });

  it('places the canvas over its workspace group and hides it while another document shows', () => {
    expect(CSS).toContain('.gjs-st-ws-on .gjs-cv-canvas');
    expect(CSS).toContain('var(--gjs-st-cv-x');
    expect(CSS).toContain('.gjs-st-canvas-off');
  });
});
