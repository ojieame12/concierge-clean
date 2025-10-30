/**
 * Common product card selectors across e-commerce platforms
 * Organized by platform with generic fallbacks
 */

// Product card container selectors
export const CARD_SELECTORS: string[] = [
  // Shopify-ish (legacy references, but works for custom sites too)
  ".product-card",
  ".grid-product",
  ".product-grid-item",
  ".card-wrapper",
  "[data-product-card]",
  
  // WooCommerce-ish
  "li.product",
  ".product",
  ".woocommerce-LoopProduct-link",
  
  // BigCommerce-ish
  ".card",
  ".listItem-product",
  
  // Generic fallbacks (custom platforms)
  "[data-product]",
  "[class*='product-card']",
  "[class*='product-item']",
  "[class*='product']",
  ".item",
  ".grid-item"
];

// Product title selectors
export const TITLE_SELECTORS = [
  "h2",
  "h3",
  ".product-title",
  ".title",
  ".product-name",
  "[data-product-title]",
  "[itemprop='name']"
];

// Product price selectors
export const PRICE_SELECTORS = [
  ".price",
  ".product-price",
  "[data-price]",
  "[itemprop='price']",
  ".cost",
  ".amount"
];

// CTA button selectors
export const CTA_SELECTORS = [
  "button",
  "[role='button']",
  "a.button",
  ".btn",
  ".Button",
  "[class*='primary']",
  "[class*='cta']",
  ".add-to-cart",
  ".buy-now"
];

// Logo selectors
export const LOGO_SELECTORS = [
  'header img[alt*="logo" i]',
  '.logo img',
  'nav img',
  '.navbar img',
  '.site-logo',
  '[class*="logo"] img'
];

// Favicon selectors
export const FAVICON_SELECTORS = [
  'link[rel="icon"]',
  'link[rel="shortcut icon"]',
  'link[rel="apple-touch-icon"]'
];
