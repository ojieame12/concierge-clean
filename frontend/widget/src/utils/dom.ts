/**
 * DOM helper utilities for element selection and measurement
 */

/**
 * Pick the first element matching any of the selectors
 * Optional filter function for additional validation
 */
export function pickFirst<T = Element>(
  selectors: string[],
  filter?: (el: Element) => boolean
): Element | null {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el && (!filter || filter(el))) return el;
  }
  return null;
}

/**
 * Get element dimensions
 */
export function sizeOf(el: Element) {
  const r = (el as HTMLElement).getBoundingClientRect();
  return { w: r.width, h: r.height };
}

/**
 * Get computed styles for element
 */
export function getStyle(el: Element) {
  return window.getComputedStyle(el as Element);
}

/**
 * Check if element is visible in viewport
 */
export function isVisible(el: Element): boolean {
  const rect = (el as HTMLElement).getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.top >= 0 &&
    rect.left >= 0
  );
}
