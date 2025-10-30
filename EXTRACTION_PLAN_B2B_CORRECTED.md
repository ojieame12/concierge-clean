# CSS Extraction Plan - B2B/White-Label Corrected

**Date:** October 30, 2025  
**Context:** Correcting the extraction plan to focus on the **actual business model**: B2B/white-label deployment, NOT Shopify merchants.

---

## The Real Business Model

**What Insite Actually Is:**
- **B2B conversational commerce platform**
- **White-label ready** for enterprise deployment
- Clients deploy Insite on **their own e-commerce sites** (custom platforms, headless commerce, etc.)
- NOT a Shopify app or merchant-facing SaaS

**From README:**
> "Insite B2B Conversational Commerce Platform - A clean, production-ready conversational commerce platform for B2B and white-label deployments."

> "Removed all Shopify-specific code - Optimized for B2B/white-label deployment"

---

## Why the Shopify Focus Was Wrong

**The Mistake:**
I assumed "merchants" meant Shopify store owners who would install Insite as an app. This led to:
- ❌ Shopify Asset API integration
- ❌ Shopify-specific selectors
- ❌ "Merchant onboarding" language
- ❌ Focus on external website scraping

**The Reality:**
Insite is deployed **directly on the client's website**. The client is a **B2B enterprise** (e.g., outdoor gear distributor, industrial supplies company) who wants to add conversational commerce to their existing site.

---

## Corrected Use Case

### Who Are the "Merchants"?

**Not:** Shopify store owners  
**Actually:** B2B enterprises deploying Insite on their own sites

**Examples:**
- Industrial equipment distributor with custom e-commerce platform
- Outdoor gear wholesaler with headless commerce (Commercetools, Elastic Path)
- Office supplies company with legacy .NET e-commerce
- Manufacturing company with custom B2B portal

### What Do They Need?

**Not:** Extract styles from their Shopify store  
**Actually:** Make Insite's concierge **match their existing site design**

**The Real Problem:**
Client deploys Insite widget on their site. The concierge product cards should **match their existing product cards** so it feels native, not like a third-party widget.

---

## Corrected Extraction Strategy

### Option 1: Configuration During Deployment (Recommended)

**Flow:**
1. Client deploys Insite on their site (embed widget or full-page)
2. During deployment, Insite's **onboarding wizard** runs **on their domain**
3. Wizard detects product cards on the **same page** (no external scraping)
4. Extracts computed styles using `getComputedStyle()`
5. Maps to theme schema
6. Saves as client's default theme

**Why This Works:**
- ✅ No external scraping (runs on client's own domain)
- ✅ No CORS issues (same origin)
- ✅ No robots.txt concerns (client's own site)
- ✅ No anti-bot issues (legitimate widget initialization)
- ✅ Accurate styles (real browser, real page)

**Implementation:**
```ts
// Runs in client's browser during widget initialization
export function initializeInsiteWidget(config: WidgetConfig) {
  // Detect if theme is already configured
  if (config.theme) {
    return renderWidget(config.theme);
  }
  
  // Auto-extract theme from current page
  const extractedTheme = extractThemeFromPage();
  
  // Save to Insite backend
  await saveTheme(config.clientId, extractedTheme);
  
  // Render widget with extracted theme
  renderWidget(extractedTheme);
}

function extractThemeFromPage(): Theme {
  // Find product card on current page
  const selectors = [
    '.product-card',
    '.product-item',
    '[data-product]',
    '.grid-item',
    // Generic fallbacks
    '[class*="product"]'
  ];
  
  let card = null;
  for (const sel of selectors) {
    card = document.querySelector(sel);
    if (card) break;
  }
  
  if (!card) {
    console.warn('No product card found, using default theme');
    return DEFAULT_THEME;
  }
  
  // Extract computed styles
  const cs = (el: Element) => window.getComputedStyle(el);
  const $ = (q: string) => card.querySelector(q);
  
  const box = cs(card);
  const img = $('img');
  const title = $('h2, h3, .product-title, .title, [class*="title"]');
  const price = $('.price, .product-price, [class*="price"]');
  
  return {
    card: {
      variant: detectVariant(box.boxShadow, box.border),
      radius: box.borderRadius || '12px',
      shadow: mapShadow(box.boxShadow),
      imageAspect: calculateAspect(img)
    },
    fonts: {
      lead: normalizeFontFamily(cs(title).fontFamily),
      detail: normalizeFontFamily(cs(price).fontFamily)
    },
    cta: {
      bg: extractCTAColor(), // From existing buttons on page
      radius: extractCTARadius()
    },
    logo: {
      src: extractLogoFromPage(),
      alt: document.title,
      heroHeight: 80,
      navHeight: 32
    }
  };
}

function extractCTAColor(): string {
  // Find primary CTA button on page
  const ctaSelectors = [
    '.btn-primary',
    '.add-to-cart',
    '[class*="primary"]',
    'button[type="submit"]'
  ];
  
  for (const sel of ctaSelectors) {
    const btn = document.querySelector(sel);
    if (btn) {
      const bg = window.getComputedStyle(btn).backgroundColor;
      return rgbToHex(bg);
    }
  }
  
  return '#3B82F6'; // Default
}

function extractLogoFromPage(): string {
  // Find logo in header
  const logo = document.querySelector('header img[alt*="logo" i], .logo img, [class*="logo"] img');
  return logo?.getAttribute('src') || '';
}
```

---

### Option 2: Manual Configuration (Fallback)

If auto-extraction fails or client has complex layout:

**Flow:**
1. Client opens Insite admin panel (embedded in their site or separate dashboard)
2. Sees theme editor with live preview
3. Manually configures 5 customization points
4. Saves theme

**This is what we already built!** The theme editor at `/theme-editor`.

---

### Option 3: Pre-Deployment Consultation

For enterprise clients with custom requirements:

**Flow:**
1. Insite team does pre-deployment consultation
2. Client provides design system documentation
3. Insite team configures theme manually
4. Theme deployed with widget

---

## Revised Implementation Plan

### Phase 1: Widget Auto-Initialization (3 hours)

**Create client-side extraction during widget init:**

**File: `frontend/src/lib/theme-extractor.ts`**
```ts
// Client-side theme extraction (runs in client's browser)
export function extractThemeFromCurrentPage(): Theme {
  // Find product card on current page
  const card = findProductCard();
  if (!card) return DEFAULT_THEME;
  
  // Extract computed styles
  const styles = extractComputedStyles(card);
  
  // Map to theme schema
  return mapStylesToTheme(styles);
}

function findProductCard(): Element | null {
  const selectors = [
    '.product-card',
    '.product-item',
    '[data-product]',
    '.grid-item',
    '[class*="product"]'
  ];
  
  for (const sel of selectors) {
    const card = document.querySelector(sel);
    if (card) return card;
  }
  
  return null;
}
```

**File: `frontend/src/lib/widget-init.ts`**
```ts
// Widget initialization with auto-extraction
export async function initializeInsiteWidget(config: WidgetConfig) {
  // Check if theme already configured
  const existingTheme = await fetchTheme(config.clientId);
  
  if (existingTheme) {
    return renderWidget(existingTheme);
  }
  
  // Auto-extract theme from current page
  const extractedTheme = extractThemeFromCurrentPage();
  
  // Save to backend
  await saveTheme(config.clientId, extractedTheme);
  
  // Render widget
  renderWidget(extractedTheme);
}
```

---

### Phase 2: Admin Theme Editor (Already Done!) ✅

We already built this:
- `/theme-editor` page with live preview
- 5 customization controls
- Save to backend API
- WCAG AA compliance

**No changes needed.** This is the manual fallback.

---

### Phase 3: Logo Auto-Detection (1 hour)

**Add logo extraction from current page:**

```ts
function extractLogoFromPage(): { src: string; alt: string } {
  // Try header logo first
  const headerLogo = document.querySelector('header img[alt*="logo" i], header .logo img');
  if (headerLogo) {
    return {
      src: headerLogo.getAttribute('src') || '',
      alt: headerLogo.getAttribute('alt') || document.title
    };
  }
  
  // Try nav logo
  const navLogo = document.querySelector('nav img, .navbar img');
  if (navLogo) {
    return {
      src: navLogo.getAttribute('src') || '',
      alt: navLogo.getAttribute('alt') || document.title
    };
  }
  
  // Fallback to first image in header
  const firstImg = document.querySelector('header img');
  if (firstImg) {
    return {
      src: firstImg.getAttribute('src') || '',
      alt: document.title
    };
  }
  
  return { src: '', alt: document.title };
}
```

---

### Phase 4: CTA Color Auto-Detection (1 hour)

**Extract primary button color from page:**

```ts
function extractCTAColor(): string {
  const ctaSelectors = [
    '.btn-primary',
    '.button-primary',
    '.add-to-cart',
    '.buy-now',
    '[class*="primary-button"]',
    'button[type="submit"]'
  ];
  
  for (const sel of ctaSelectors) {
    const btn = document.querySelector(sel);
    if (btn) {
      const bg = window.getComputedStyle(btn).backgroundColor;
      // Convert rgb(r, g, b) to hex
      return rgbToHex(bg);
    }
  }
  
  return '#3B82F6'; // Default blue
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/\d+/g);
  if (!match) return '#3B82F6';
  
  const [r, g, b] = match.map(Number);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
```

---

## Key Differences from Shopify-Focused Plan

| Aspect | Shopify Plan (Wrong) | B2B Plan (Correct) |
|--------|---------------------|-------------------|
| **Who** | Shopify merchants | B2B enterprises |
| **Where** | External Shopify stores | Client's own site |
| **When** | During merchant onboarding | During widget initialization |
| **How** | Puppeteer scraping external URL | Client-side extraction on same page |
| **CORS** | Need to handle | No issue (same origin) |
| **robots.txt** | Need to check | Not applicable (own site) |
| **Anti-bot** | Need stealth/bookmarklet | Not applicable (legitimate widget) |
| **API** | Shopify Asset API | Not applicable |
| **Deployment** | Merchant installs app | Enterprise deploys widget |

---

## Revised Timeline

**Total: 5 hours** (down from 7-8 hours)

1. **Widget Auto-Initialization** (3 hours)
   - Client-side theme extraction
   - Widget init with auto-extraction
   - Save to backend API

2. **Logo Auto-Detection** (1 hour)
   - Extract logo from header/nav
   - Fallback logic

3. **CTA Color Auto-Detection** (1 hour)
   - Extract primary button color
   - RGB to hex conversion

**Theme Editor:** Already done! ✅ (manual fallback)

---

## Deployment Flow

### Enterprise Client Deploys Insite

**Step 1: Client adds widget script to their site**
```html
<script src="https://cdn.insite.com/widget.js"></script>
<script>
  Insite.init({
    clientId: 'acme-industrial',
    apiKey: 'your-api-key',
    // Theme will be auto-extracted on first load
  });
</script>
```

**Step 2: Widget auto-extracts theme on first load**
- Finds product card on current page
- Extracts computed styles
- Saves to Insite backend
- Renders with extracted theme

**Step 3: Client can customize in admin panel (optional)**
- Opens `/theme-editor` (or embedded admin)
- Tweaks logo, fonts, colors, card variant
- Saves changes

**Step 4: Widget uses saved theme on all future loads**
- No re-extraction needed
- Fast load time
- Consistent branding

---

## Edge Cases

### No Product Cards on Page

**Scenario:** Widget deployed on homepage, no product cards visible.

**Solution:**
1. Use default theme on first load
2. Show admin notification: "Customize your theme"
3. Client uses theme editor to configure manually
4. OR client provides URL to product listing page for extraction

### Custom Product Card Structure

**Scenario:** Client has unusual product card DOM (e.g., shadow DOM, web components).

**Solution:**
1. Auto-extraction fails gracefully
2. Falls back to default theme
3. Client uses theme editor to configure manually

### Multiple Product Card Styles

**Scenario:** Client has different card styles for featured vs. regular products.

**Solution:**
1. Extract from first **non-featured** card (skip hero/spotlight)
2. Use `card:not(.featured):not(.hero)` selector

---

## Security & Privacy

### No External Scraping
- ✅ Extraction runs on client's own domain (same origin)
- ✅ No CORS issues
- ✅ No robots.txt concerns
- ✅ No anti-bot issues

### Client Consent
- ✅ Client deploys widget (implicit consent)
- ✅ Extraction only happens on client's own site
- ✅ No third-party data access

### Data Storage
- ✅ Store theme tokens only (colors, fonts, spacing)
- ✅ Never store HTML, product data, or page content
- ✅ Theme tied to client ID (isolated per client)

---

## Success Metrics

### Auto-Extraction Accuracy
- ✅ 80%+ successful extraction on first load
- ✅ 90%+ clients accept extracted theme without changes
- ✅ <5% extraction failures

### Client Satisfaction
- ✅ Widget feels native (matches site design)
- ✅ No manual configuration needed for most clients
- ✅ Easy customization for edge cases

### Performance
- ✅ <1 second extraction time (client-side, no network)
- ✅ Theme cached after first extraction
- ✅ No impact on page load time

---

## Conclusion

**The Corrected Approach:**

1. **Auto-extract theme during widget initialization** (client-side, same origin)
2. **Use theme editor as manual fallback** (already built)
3. **No external scraping, no Shopify APIs, no anti-bot workarounds**

**Why This Is Better:**

- ✅ Simpler (no Puppeteer, no external scraping)
- ✅ Faster (<1 second vs. 10 seconds)
- ✅ More reliable (no network issues, no bot detection)
- ✅ More secure (same origin, no external access)
- ✅ Matches actual business model (B2B/white-label)

**Timeline:** 5 hours (vs. 7-8 hours for Shopify plan)

**Next Step:** Implement client-side theme extraction in widget initialization.
