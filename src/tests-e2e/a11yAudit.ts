import type { Page } from 'playwright-core';

/**
 * Deterministic, dependency-free accessibility checks for a rendered region. They catch defects that
 * automation can see (unnamed controls, unlabelled fields, duplicate IDs, images without alt text,
 * positive tabindex). They do not establish WCAG conformance, which needs manual assistive-technology
 * testing and acceptance.
 */
export type A11yFinding = { rule: string; element: string };

export async function auditAccessibility(page: Page, rootSelector = 'main, body'): Promise<A11yFinding[]> {
  return page.evaluate(selector => {
    const root = document.querySelector(selector) ?? document.body;
    const findings: { rule: string; element: string }[] = [];
    const describe = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : ''} "${(el.textContent ?? '').trim().slice(0, 40)}"`;
    const visible = (el: Element) => {
      const h = el as HTMLElement;
      if (h.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
      const style = getComputedStyle(h);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = h.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const labelledBy = (el: Element) => (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean).map(id => text(document.getElementById(id))).join(' ').trim();
    const nameOf = (el: Element): string => {
      const aria = (el.getAttribute('aria-label') ?? '').trim(); if (aria) return aria;
      const by = labelledBy(el); if (by) return by;
      const input = el as HTMLInputElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
        if (input.labels && input.labels.length) { const l = Array.from(input.labels).map(text).join(' ').trim(); if (l) return l; }
        const t = (el.getAttribute('title') ?? '').trim(); if (t) return t;
        if (input.type === 'submit' || input.type === 'button') return (input.value ?? '').trim();
        return '';
      }
      const own = text(el); if (own) return own;
      const img = el.querySelector('img[alt]'); if (img && img.getAttribute('alt')!.trim()) return img.getAttribute('alt')!.trim();
      return (el.getAttribute('title') ?? '').trim();
    };
    const controls = root.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="link"], [role="checkbox"], [role="combobox"]');
    for (const el of Array.from(controls)) {
      if (!visible(el)) continue;
      if (!nameOf(el)) findings.push({ rule: ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) ? 'field-without-label' : 'control-without-name', element: describe(el) });
    }
    const ids = new Map<string, number>();
    for (const el of Array.from(document.querySelectorAll('[id]'))) ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
    for (const [id, n] of ids) if (n > 1 && root.querySelector(`[id="${CSS.escape(id)}"]`)) findings.push({ rule: 'duplicate-id', element: `#${id} x${n}` });
    for (const img of Array.from(root.querySelectorAll('img'))) if (visible(img) && !img.hasAttribute('alt')) findings.push({ rule: 'image-without-alt', element: describe(img) });
    for (const el of Array.from(root.querySelectorAll('[tabindex]'))) if (Number(el.getAttribute('tabindex')) > 0) findings.push({ rule: 'positive-tabindex', element: describe(el) });
    return findings;
  }, rootSelector);
}
