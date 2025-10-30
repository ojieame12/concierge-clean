# CSS Extraction Plan Comparison

**Date:** October 30, 2025

Comparing my research-based plan with the provided "no knobs" plan for plug-and-play CSS extraction.

---

## Core Agreement: 95% Aligned ✅

Both plans fundamentally agree on the **primary approach**:

1. **Headless browser** (Puppeteer/Playwright) to render the merchant's site
2. **`window.getComputedStyle()`** to extract actual rendered styles (not static CSS)
3. **Map extracted values** to our safe allowlisted tokens
4. **Platform-specific selectors** to find product cards
5. **Respect robots.txt** and merchant consent
6. **Store tokens only**, never HTML/content
7. **<10 second** extraction time target

**Verdict:** The core technical approach is identical. Both plans are sound.

---

## Key Differences & Enhancements

### 1. **Bookmarklet Fallback** (Their Plan) 🆕

**Their Addition:**
> Give merchants a **one-click bookmarklet** they run on their own domain. It reads computed styles via `getComputedStyle()` and posts JSON to `/theme/extract` endpoint.

**Why This Is Brilliant:**
- ✅ Bypasses anti-bot protection (runs in merchant's real browser)
- ✅ No CORS issues (merchant's own session)
- ✅ Works on sites that block headless browsers
- ✅ Extremely accurate (real browser, real session)
- ✅ Simple UX: "Open your store, click Calibrate"

**My Plan:** Only mentioned "manual fallback with iframe click-to-select"

**Verdict:** **Bookmarklet is superior.** Adopt this approach.

---

### 2. **Shopify Asset API** (Their Plan) 🆕

**Their Addition:**
> If merchant is on Shopify and grants Admin access, fetch theme assets like `config/settings_data.json` via the **Asset** endpoint. This gives theme colors/fonts with **no rendering step**.

**Why This Is Valuable:**
- ✅ Official API (no scraping)
- ✅ Gets theme settings directly (colors, fonts, spacing)
- ✅ Faster than rendering (no browser launch)
- ✅ More reliable (structured data)

**My Plan:** Mentioned "Platform-Specific APIs" but didn't detail Shopify Asset endpoint

**Verdict:** **Great enhancement.** Use as first attempt for Shopify stores, fall back to headless if needed.

---

### 3. **Playwright vs. Puppeteer** (Their Plan)

**Their Suggestion:**
> Playwright's locator model is robust if you choose it over Puppeteer; selectors and codegen reduce flake.

**My Plan:** Recommended Puppeteer (already in stack)

**Analysis:**
- **Puppeteer:** More popular, larger community, we already use it
- **Playwright:** Better selector reliability, better codegen, cross-browser

**Verdict:** **Stick with Puppeteer for now** (already in stack), but consider Playwright if we hit selector flakiness.

---

### 4. **Stealth Plugin Warning** (Their Plan) ⚠️

**Their Warning:**
> Some teams use "stealth" plugins. They're increasingly detectable and not well-maintained; better to use standard headless with merchant consent.

**My Plan:** Mentioned "Use stealth plugin" as anti-bot solution

**Verdict:** **They're right.** Remove stealth plugin recommendation. Use:
1. Standard headless with merchant consent
2. Bookmarklet fallback for anti-bot sites

---

### 5. **Custom Font Handling** (Their Plan)

**Their Detail:**
> If site uses licensed/uncommon font, either **load it with CSS Font Loading API** (if merchant provides legal URL) or pick closest curated fallback.

**My Plan:** Just "normalize to Google Fonts allowlist"

**Verdict:** **Their approach is more complete.** Add option to load custom fonts if merchant provides URL.

---

### 6. **Detailed Style Extraction** (Their Plan)

**Their Code Extracts More:**
```ts
title: {
  fontFamily: cs(title).fontFamily,
  fontSize: cs(title).fontSize,
  fontWeight: cs(title).fontWeight,
  lineHeight: cs(title).lineHeight,
  letterSpacing: cs(title).letterSpacing
}
```

**My Plan:** Only extracted `fontFamily`

**Verdict:** **Extract more details.** We can map fontSize/weight/lineHeight to our tokens or store as micro-adjustments.

---

### 7. **Two-Endpoint Design** (Their Plan)

**Their Endpoints:**
- `POST /v1/theme/extract` - Headless extraction
- `POST /v1/theme/calibrate` - Bookmarklet submission

**My Plan:** Only `POST /v1/theme/extract`

**Verdict:** **Two endpoints is cleaner.** Separates headless vs. browser-side extraction.

---

### 8. **robots.txt Module** (Their Plan)

**Their Addition:**
> `robots.ts`: fetch & respect robots rules (log decisions)

**My Plan:** Mentioned "respect robots.txt" but didn't detail implementation

**Verdict:** **Add dedicated robots.ts module** for proper compliance.

---

## Enhanced Implementation Plan

### Combining Best of Both Plans

**Phase 1: Core Extraction (3 hours)**

**File: `backend/src/core/theme/extractor.ts`**
```ts
// Headless browser extraction using Puppeteer
export async function extractThemeFromURL(url: string, platformHint?: string) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.goto(url, { waitUntil: 'networkidle0' });
  
  // Use platform-specific selectors
  const selector = await findProductCardSelector(page, platformHint);
  
  const styles = await page.$eval(selector, (el) => {
    const cs = (n: Element) => window.getComputedStyle(n);
    const $ = (q: string) => el.querySelector(q);
    
    const box = cs(el);
    const img = $('img');
    const title = $('h2, h3, .product-title, .title');
    const price = $('.price, .product-price, [data-price]');
    
    return {
      card: {
        borderRadius: box.borderRadius,
        boxShadow: box.boxShadow,
        backgroundColor: box.backgroundColor,
        padding: box.padding
      },
      image: img ? {
        width: cs(img).width,
        height: cs(img).height
      } : null,
      title: title ? {
        fontFamily: cs(title).fontFamily,
        fontSize: cs(title).fontSize,
        fontWeight: cs(title).fontWeight,
        lineHeight: cs(title).lineHeight,
        letterSpacing: cs(title).letterSpacing
      } : null,
      price: price ? {
        fontFamily: cs(price).fontFamily,
        fontSize: cs(price).fontSize,
        fontWeight: cs(price).fontWeight
      } : null
    };
  });
  
  await browser.close();
  return styles;
}
```

**File: `backend/src/core/theme/selectors.ts`**
```ts
// Platform-specific selector library
export const PLATFORM_SELECTORS = {
  shopify: [
    '.product-card',
    '.grid-product',
    '.product-grid-item',
    '.card-wrapper',
    '[data-product-card]'
  ],
  woocommerce: [
    'li.product',
    '.product',
    '.woocommerce-LoopProduct-link'
  ],
  bigcommerce: [
    '.product-card',
    '.card',
    '.listItem-product'
  ],
  fallback: [
    '[data-product]',
    '[class*="product-card"]',
    '[class*="product"]'
  ]
};

export async function findProductCardSelector(
  page: Page,
  platformHint?: string
): Promise<string> {
  const platform = platformHint || 'fallback';
  const selectors = PLATFORM_SELECTORS[platform] || PLATFORM_SELECTORS.fallback;
  
  for (const selector of selectors) {
    const exists = await page.$(selector);
    if (exists) return selector;
  }
  
  throw new Error('No product card found');
}
```

**File: `backend/src/core/theme/mapper.ts`**
```ts
// Map extracted styles to theme schema
export function mapStylesToTheme(extracted: ExtractedStyles): Theme {
  return {
    card: {
      variant: detectCardVariant(extracted.card.boxShadow, extracted.card.border),
      radius: clampRadius(extracted.card.borderRadius),
      shadow: mapShadowToAllowlist(extracted.card.boxShadow),
      imageAspect: calculateAspectRatio(extracted.image)
    },
    fonts: {
      lead: normalizeFontFamily(extracted.title?.fontFamily),
      detail: normalizeFontFamily(extracted.price?.fontFamily)
    },
    // Store detailed typography as micro-tokens
    typography: {
      title: {
        size: extracted.title?.fontSize,
        weight: extracted.title?.fontWeight,
        lineHeight: extracted.title?.lineHeight,
        letterSpacing: extracted.title?.letterSpacing
      }
    }
  };
}

function mapShadowToAllowlist(boxShadow: string): 'none' | 'sm' | 'md' | 'lg' {
  if (!boxShadow || boxShadow === 'none') return 'none';
  
  // Parse blur radius from shadow string
  const match = boxShadow.match(/(\d+)px/g);
  if (!match) return 'md';
  
  const blur = parseInt(match[2] || match[0]);
  if (blur <= 4) return 'sm';
  if (blur <= 10) return 'md';
  return 'lg';
}

function clampRadius(borderRadius: string): string {
  const px = parseInt(borderRadius);
  return `${Math.min(Math.max(px, 0), 24)}px`;
}

function calculateAspectRatio(image: { width: string; height: string } | null): string {
  if (!image) return '4:5';
  
  const w = parseInt(image.width);
  const h = parseInt(image.height);
  const ratio = w / h;
  
  if (Math.abs(ratio - 1) < 0.1) return '1:1';
  if (Math.abs(ratio - 0.8) < 0.1) return '4:5';
  if (Math.abs(ratio - 0.75) < 0.1) return '3:4';
  if (Math.abs(ratio - 1.78) < 0.1) return '16:9';
  
  return '4:5'; // default
}

function normalizeFontFamily(fontFamily: string | undefined): string {
  if (!fontFamily) return 'Inter';
  
  // Extract first font from stack
  const first = fontFamily.split(',')[0].trim().replace(/['"]/g, '');
  
  // Check if in allowlist
  if (FONT_ALLOWLIST.has(first)) return first;
  
  // Find closest match (basic similarity)
  // TODO: Use font metrics or merchant-provided custom font URL
  return 'Inter'; // fallback
}
```

**File: `backend/src/core/theme/robots.ts`**
```ts
// robots.txt compliance
import robotsParser from 'robots-parser';

export async function checkRobots(url: string): Promise<boolean> {
  try {
    const robotsUrl = new URL('/robots.txt', url).toString();
    const response = await fetch(robotsUrl);
    const robotsTxt = await response.text();
    
    const robots = robotsParser(robotsUrl, robotsTxt);
    const allowed = robots.isAllowed(url, 'InsiteConcierge');
    
    console.log(`robots.txt check for ${url}: ${allowed ? 'ALLOWED' : 'DISALLOWED'}`);
    return allowed;
  } catch (err) {
    console.log(`robots.txt not found for ${url}, proceeding with consent`);
    return true; // No robots.txt = allowed
  }
}
```

---

**Phase 2: Shopify Enhancement (1 hour)**

**File: `backend/src/core/theme/shopify.ts`**
```ts
// Shopify Asset API integration
export async function extractShopifyTheme(
  shopDomain: string,
  accessToken: string
): Promise<Partial<Theme>> {
  // Fetch theme settings from Shopify Admin API
  const response = await fetch(
    `https://${shopDomain}/admin/api/2024-01/themes.json`,
    {
      headers: { 'X-Shopify-Access-Token': accessToken }
    }
  );
  
  const { themes } = await response.json();
  const activeTheme = themes.find(t => t.role === 'main');
  
  // Fetch settings_data.json asset
  const settingsResponse = await fetch(
    `https://${shopDomain}/admin/api/2024-01/themes/${activeTheme.id}/assets.json?asset[key]=config/settings_data.json`,
    {
      headers: { 'X-Shopify-Access-Token': accessToken }
    }
  );
  
  const { asset } = await settingsResponse.json();
  const settings = JSON.parse(asset.value);
  
  // Extract theme colors, fonts from settings
  return {
    cta: {
      bg: settings.current?.colors?.accent || '#3B82F6'
    },
    fonts: {
      lead: settings.current?.typography?.heading_font || 'Inter',
      detail: settings.current?.typography?.body_font || 'Inter'
    }
  };
}
```

---

**Phase 3: Bookmarklet Fallback (2 hours)**

**File: `frontend/public/calibrate-bookmarklet.js`**
```js
// Bookmarklet that merchants run on their own site
(function() {
  // Find product card
  const selectors = [
    '.product-card', '.grid-product', '.product-grid-item',
    'li.product', '.product', '[data-product]'
  ];
  
  let card = null;
  for (const sel of selectors) {
    card = document.querySelector(sel);
    if (card) break;
  }
  
  if (!card) {
    alert('No product card found. Please run this on a product listing page.');
    return;
  }
  
  // Extract computed styles
  const cs = (el) => window.getComputedStyle(el);
  const $ = (q) => card.querySelector(q);
  
  const box = cs(card);
  const img = $('img');
  const title = $('h2, h3, .product-title, .title');
  const price = $('.price, .product-price, [data-price]');
  
  const extracted = {
    card: {
      borderRadius: box.borderRadius,
      boxShadow: box.boxShadow,
      backgroundColor: box.backgroundColor,
      padding: box.padding
    },
    image: img ? {
      width: cs(img).width,
      height: cs(img).height
    } : null,
    title: title ? {
      fontFamily: cs(title).fontFamily,
      fontSize: cs(title).fontSize,
      fontWeight: cs(title).fontWeight
    } : null,
    price: price ? {
      fontFamily: cs(price).fontFamily,
      fontSize: cs(price).fontSize
    } : null
  };
  
  // Send to our API
  fetch('https://your-api.com/v1/theme/calibrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Send auth cookies
    body: JSON.stringify(extracted)
  })
  .then(res => res.json())
  .then(data => {
    alert('Theme calibrated successfully!');
  })
  .catch(err => {
    alert('Calibration failed: ' + err.message);
  });
})();
```

**File: `backend/src/routes/theme.ts`** (add endpoint)
```ts
// POST /v1/theme/calibrate
router.post('/calibrate', async (req, res) => {
  const { shopId } = req.auth; // from session
  const extracted = req.body;
  
  // Map to theme schema
  const theme = mapStylesToTheme(extracted);
  
  // Save to database
  await saveTheme(shopId, theme);
  
  res.json({ success: true, theme });
});
```

---

**Phase 4: API Routes (1 hour)**

**File: `backend/src/routes/theme.ts`** (add endpoint)
```ts
// POST /v1/theme/extract
router.post('/extract', async (req, res) => {
  const { url, platformHint, method } = req.body;
  const { shopId } = req.auth;
  
  try {
    // Check robots.txt
    const allowed = await checkRobots(url);
    if (!allowed) {
      return res.status(403).json({
        error: 'robots.txt disallows crawling. Please use the bookmarklet method.'
      });
    }
    
    let extracted;
    
    // Try Shopify API first if platform is Shopify
    if (platformHint === 'shopify' && req.body.accessToken) {
      const shopifyTheme = await extractShopifyTheme(url, req.body.accessToken);
      // Fall through to headless for missing details
    }
    
    // Headless extraction
    if (method === 'headless') {
      extracted = await extractThemeFromURL(url, platformHint);
    }
    
    // Map to theme schema
    const theme = mapStylesToTheme(extracted);
    
    // Save to database
    await saveTheme(shopId, theme);
    
    res.json({
      success: true,
      theme,
      diagnostics: {
        method: 'headless',
        selector: extracted.selector,
        extractionTime: extracted.time
      }
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      suggestion: 'Try the bookmarklet method instead'
    });
  }
});
```

---

## Final Comparison Summary

| Feature | My Plan | Their Plan | Winner |
|---------|---------|------------|--------|
| **Core Approach** | Puppeteer + getComputedStyle | Puppeteer/Playwright + getComputedStyle | **Tie** ✅ |
| **Platform Selectors** | Yes, detailed library | Yes, detailed library | **Tie** ✅ |
| **Style Mapping** | Basic (radius, shadow, fonts) | Detailed (typography, spacing) | **Their Plan** 🏆 |
| **Shopify API** | Mentioned, not detailed | Detailed Asset API usage | **Their Plan** 🏆 |
| **Bookmarklet Fallback** | Not included | Brilliant addition | **Their Plan** 🏆 |
| **Anti-Bot Handling** | Stealth plugin (bad) | Standard + bookmarklet | **Their Plan** 🏆 |
| **Custom Fonts** | Just normalize | Load via CSS Font API | **Their Plan** 🏆 |
| **robots.txt** | Mentioned | Dedicated module | **Their Plan** 🏆 |
| **Two Endpoints** | One endpoint | Two (extract + calibrate) | **Their Plan** 🏆 |
| **Implementation Detail** | High-level | Code examples | **My Plan** 🏆 |

---

## Recommended Final Plan

**Combine the best of both:**

1. **Primary Method:** Headless Puppeteer with `getComputedStyle()` ✅
2. **Shopify Enhancement:** Use Asset API first, fall back to headless ✅
3. **Bookmarklet Fallback:** For anti-bot sites or merchant preference ✅
4. **Detailed Extraction:** Extract typography details (size, weight, line-height) ✅
5. **robots.txt Module:** Dedicated compliance checking ✅
6. **Two Endpoints:** `/extract` (headless) + `/calibrate` (bookmarklet) ✅
7. **No Stealth Plugin:** Use standard headless + merchant consent ✅
8. **Custom Font Support:** Load via CSS Font Loading API if provided ✅

---

## Implementation Timeline

**Total: 7 hours** (down from 8 hours in my original plan)

1. **Core Extraction** (3 hours) - extractor.ts, selectors.ts, mapper.ts, robots.ts
2. **Shopify Enhancement** (1 hour) - shopify.ts, Asset API integration
3. **Bookmarklet Fallback** (2 hours) - calibrate-bookmarklet.js, /calibrate endpoint
4. **Testing** (1 hour) - Test on Shopify, WooCommerce, custom sites

---

## Conclusion

**Their plan is superior in 8 out of 9 categories.** The key enhancements are:

1. **Bookmarklet fallback** - Brilliant solution for anti-bot sites
2. **Shopify Asset API** - Faster, more reliable for Shopify stores
3. **Detailed typography extraction** - More accurate theme matching
4. **No stealth plugin** - More maintainable, ethical approach

**Recommendation:** Adopt their plan with the detailed implementation from my research.

**Next Step:** Implement the combined plan with all enhancements.
