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

  it('lets long translated tab labels wrap inside the tab instead of overflowing it', () => {
    const rule = CSS.match(/\.gjs-lsb-tab\{[^}]*\}/)![0];
    expect(rule).toContain('min-width:0');
    expect(rule).toContain('overflow-wrap:break-word');
    expect(rule).not.toContain('nowrap');
  });

  it('keeps hidden bottom panels hidden', () => {
    expect(CSS).toContain('.gjs-lsb-panel[hidden]{display:none !important;}');
  });

  it('shows the resizer and bottom pane only in the open state', () => {
    expect(CSS).toMatch(/\.gjs-lsb-resizer\{display:none;/);
    expect(CSS).toMatch(/\.gjs-lsb-bottom\{display:none;/);
    expect(CSS).toContain('.gjs-lsb-split--open .gjs-lsb-resizer{display:block;}');
    expect(CSS).toContain('.gjs-lsb-split--open .gjs-lsb-bottom{display:flex;}');
  });
});
