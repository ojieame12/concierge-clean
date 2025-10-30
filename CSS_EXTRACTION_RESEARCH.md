# CSS Extraction Research - Plug-and-Play Product Cards

**Date:** October 30, 2025  
**Context:** Making the theming system truly plug-and-play by automatically extracting merchant's existing product card styles

---

## The Problem

Current theming system requires merchants to **manually configure** 5 customization points. For true plug-and-play, we should **automatically extract** their existing product card styling from their website.

**Goal:** Visit merchant's website → identify product cards → extract computed styles → apply to concierge

---

## Research Findings

### Option 1: Puppeteer + getComputedStyle (Recommended)

**How it works:**
1. Launch headless browser with Puppeteer
2. Navigate to merchant's product listing page
3. Identify product card elements (via selectors or coordinates)
4. Extract computed styles using `window.getComputedStyle()`
5. Map extracted styles to our theme schema

**Advantages:**
- ✅ Gets **actual rendered styles** (not just static CSS)
- ✅ Handles complex CSS (cascading, inheritance, media queries)
- ✅ Works with JavaScript-applied styles
- ✅ Accurate browser rendering
- ✅ Already have Puppeteer in our stack

**Code Example:**
```javascript
const puppeteer = require('puppeteer');

async function extractProductCardStyles(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);

  // Find product card element
  const styles = await page.evaluate(() => {
    // Try common selectors for product cards
    const selectors = [
      '.product-card',
      '.product-item',
      '[data-product]',
      '.grid-product',
      '.product-grid-item'
    ];
    
    let element = null;
    for (const selector of selectors) {
      element = document.querySelector(selector);
      if (element) break;
    }
    
    if (!element) return null;
    
    // Get computed styles
    const computed = window.getComputedStyle(element);
    
    // Extract relevant properties
    return {
      borderRadius: computed.borderRadius,
      boxShadow: computed.boxShadow,
      backgroundColor: computed.backgroundColor,
      padding: computed.padding,
      // Image aspect ratio
      imageAspect: (() => {
        const img = element.querySelector('img');
        if (!img) return null;
        const imgComputed = window.getComputedStyle(img);
        return imgComputed.aspectRatio || 'auto';
      })(),
      // Fonts
      fonts: {
        title: (() => {
          const title = element.querySelector('h2, h3, .product-title, .title');
          if (!title) return null;
          const titleComputed = window.getComputedStyle(title);
          return titleComputed.fontFamily;
        })(),
        price: (() => {
          const price = element.querySelector('.price, .product-price');
          if (!price) return null;
          const priceComputed = window.getComputedStyle(price);
          return priceComputed.fontFamily;
        })()
      }
    };
  });

  await browser.close();
  return styles;
}
```

**Challenges:**
- Need to identify product card selectors (varies by platform)
- Some sites use shadow DOM or iframes
- Anti-scraping measures (rate limits, bot detection)

---

### Option 2: Browser Extensions (Hoverify, CSSPicker)

**How it works:**
- Merchant installs browser extension
- Hovers over product card on their site
- Extension extracts styles
- Copy/paste into our system

**Advantages:**
- ✅ User-friendly (no code)
- ✅ Visual selection
- ✅ Accurate computed styles

**Disadvantages:**
- ❌ Requires manual merchant action (not automated)
- ❌ Extra tool to install
- ❌ Not truly "plug-and-play"

**Verdict:** Good for manual testing, but not for production automation

---

### Option 3: Platform-Specific APIs (Shopify, WooCommerce, etc.)

**How it works:**
- Use platform APIs to fetch theme settings
- Extract product card configuration from theme JSON/Liquid

**Shopify Example:**
- Shopify themes use Liquid templates
- Product cards defined in `snippets/product-card.liquid`
- Theme settings in `config/settings_schema.json`
- Could use Shopify Admin API to fetch theme assets

**Advantages:**
- ✅ Official API (no scraping)
- ✅ Structured data
- ✅ Reliable

**Disadvantages:**
- ❌ Requires OAuth authentication
- ❌ Platform-specific (need separate logic for each)
- ❌ Not all platforms have APIs
- ❌ May not expose all styling details

**Verdict:** Good for major platforms, but limited coverage

---

### Option 4: Screenshot + AI Vision Analysis

**How it works:**
1. Take screenshot of merchant's product listing page
2. Use AI vision model (GPT-4 Vision, Claude Vision) to analyze
3. Identify product cards visually
4. Extract style properties from visual analysis

**Advantages:**
- ✅ Works on any website
- ✅ No selector guessing
- ✅ Can understand visual design patterns

**Disadvantages:**
- ❌ Less accurate than computed styles
- ❌ Can't extract exact CSS values (just approximations)
- ❌ Expensive (AI API costs)
- ❌ Slower than direct extraction

**Verdict:** Interesting fallback, but not primary approach

---

## Recommended Implementation Strategy

### Phase 1: Automated Extraction (Puppeteer)

**Create a new backend service:**
```
backend/src/core/theme/extractor.ts
```

**Flow:**
1. Merchant provides their website URL during onboarding
2. Backend launches Puppeteer to visit URL
3. Try common product card selectors (Shopify, WooCommerce, custom)
4. Extract computed styles for:
   - Border radius
   - Box shadow
   - Image aspect ratio
   - Font families (title, price, description)
   - Background colors
   - Padding/spacing
5. Map extracted styles to our theme schema
6. Save as merchant's default theme
7. Merchant can tweak in theme editor if needed

**Selector Strategy:**
```javascript
// Common product card selectors across platforms
const PRODUCT_CARD_SELECTORS = {
  shopify: [
    '.product-card',
    '.grid-product',
    '.product-grid-item',
    '[data-product-card]',
    '.card-wrapper'
  ],
  woocommerce: [
    '.product',
    '.product-item',
    '.woocommerce-LoopProduct-link',
    'li.product'
  ],
  bigcommerce: [
    '.card',
    '.product-card',
    '.listItem-product'
  ],
  custom: [
    '[class*="product"]',
    '[class*="card"]',
    '[data-product]'
  ]
};
```

**Style Mapping:**
```javascript
function mapExtractedStylesToTheme(extracted) {
  return {
    card: {
      variant: detectCardVariant(extracted.boxShadow, extracted.border),
      radius: extracted.borderRadius || '12px',
      shadow: mapShadowToAllowlist(extracted.boxShadow),
      imageAspect: mapAspectRatio(extracted.imageAspect)
    },
    fonts: {
      lead: normalizeFontFamily(extracted.fonts.title),
      detail: normalizeFontFamily(extracted.fonts.price)
    }
  };
}

function detectCardVariant(boxShadow, border) {
  if (boxShadow && boxShadow !== 'none') return 'base';
  if (border && border !== 'none') return 'minimal';
  return 'merchant';
}

function mapShadowToAllowlist(boxShadow) {
  // Parse shadow and map to our allowlist (none, sm, md, lg)
  if (!boxShadow || boxShadow === 'none') return 'none';
  
  // Extract blur radius from shadow
  const match = boxShadow.match(/(\d+)px/g);
  if (!match) return 'md';
  
  const blur = parseInt(match[2] || match[0]);
  if (blur <= 4) return 'sm';
  if (blur <= 10) return 'md';
  return 'lg';
}
```

---

### Phase 2: Platform-Specific Enhancers

For major platforms, add specialized extractors:

**Shopify Enhancer:**
```javascript
async function extractShopifyTheme(shopDomain) {
  // Use Shopify Storefront API (public, no auth)
  const response = await fetch(`https://${shopDomain}/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `{
        shop {
          name
          primaryDomain { url }
        }
      }`
    })
  });
  
  // Then use Puppeteer to extract visual styles
  // (Shopify doesn't expose theme CSS via API)
}
```

---

### Phase 3: Fallback to Manual

If automated extraction fails:
1. Show merchant a preview of their site in iframe
2. Let them click on a product card
3. Extract styles from clicked element
4. Save to theme

---

## Implementation Plan

### Step 1: Build Extractor Service (3 hours)
- Create `backend/src/core/theme/extractor.ts`
- Implement Puppeteer-based extraction
- Add common selector library
- Map extracted styles to theme schema

### Step 2: Add Onboarding Flow (2 hours)
- Add "Website URL" field to merchant onboarding
- Trigger extraction on save
- Show preview of extracted theme
- Allow manual tweaks

### Step 3: Add Manual Fallback (2 hours)
- Build interactive selector UI
- Let merchant click on product card
- Extract styles from clicked element

### Step 4: Testing (1 hour)
- Test on Shopify stores
- Test on WooCommerce stores
- Test on custom sites
- Verify style mapping accuracy

**Total:** 8 hours

---

## Key Technical Decisions

### 1. Use Puppeteer (Not Cheerio/BeautifulSoup)
**Why:** Need computed styles, not static CSS. Only headless browser can accurately render and compute styles.

### 2. Selector Library (Not AI Detection)
**Why:** Faster, cheaper, more reliable. Most e-commerce platforms use predictable class names.

### 3. Map to Allowlist (Not Direct Copy)
**Why:** Maintain control over quality. Extract values, then map to our allowed options.

### 4. Save as Default (Not Override)
**Why:** Merchant can still customize in theme editor. Extraction is starting point, not final.

---

## Edge Cases to Handle

### 1. Multiple Product Card Styles
Some sites have different cards for featured vs. regular products.
**Solution:** Extract from first regular product card (skip hero/featured)

### 2. Hover States
Product cards often change on hover.
**Solution:** Extract base state only (not hover)

### 3. Responsive Styles
Cards look different on mobile vs. desktop.
**Solution:** Extract desktop styles (most detailed)

### 4. Shadow DOM / iframes
Some sites use web components or iframes for product cards.
**Solution:** Use Puppeteer's frame navigation to access shadow DOM

### 5. Anti-Bot Protection
Some sites block headless browsers.
**Solution:** Use stealth plugin, rotate user agents, respect robots.txt

---

## Security & Privacy Considerations

### 1. Rate Limiting
Don't hammer merchant sites.
**Solution:** Cache extracted themes, only re-extract on manual request

### 2. Respect robots.txt
Check if scraping is allowed.
**Solution:** Use `robots-parser` library

### 3. No Data Storage
Don't store merchant's product data, only styles.
**Solution:** Extract styles only, discard HTML/content

### 4. Timeout Protection
Don't wait forever for slow sites.
**Solution:** 30-second timeout on extraction

---

## Success Metrics

### Extraction Accuracy
- ✅ 90%+ successful extraction on Shopify stores
- ✅ 80%+ successful extraction on WooCommerce stores
- ✅ 70%+ successful extraction on custom sites

### Merchant Satisfaction
- ✅ 80%+ merchants accept extracted theme without changes
- ✅ <20% merchants need manual tweaks

### Performance
- ✅ <10 seconds extraction time
- ✅ <5% extraction failures

---

## Next Steps

1. **Build extractor service** (3 hours)
2. **Add to onboarding flow** (2 hours)
3. **Test on real merchant sites** (1 hour)
4. **Add manual fallback UI** (2 hours)

**Total:** 8 hours to production-ready automated extraction

---

## Code Structure

```
backend/src/core/theme/
├── extractor.ts          # Main extraction service
├── selectors.ts          # Platform-specific selectors
├── mapper.ts             # Style → theme schema mapping
└── validator.ts          # Existing validation

backend/src/routes/
└── theme.ts              # Add POST /v1/theme/extract endpoint

frontend/src/app/onboarding/
└── theme-extraction.tsx  # Onboarding flow with extraction
```

---

## Conclusion

**Recommended Approach:** Puppeteer-based automated extraction with platform-specific selector libraries and manual fallback.

This gives us:
- ✅ True plug-and-play experience
- ✅ Accurate computed styles
- ✅ Works across platforms
- ✅ Fast (<10 seconds)
- ✅ Fallback for edge cases

**Implementation Time:** 8 hours

**ROI:** Massive improvement in merchant onboarding experience. Goes from "configure 5 settings" to "enter your URL, we'll handle the rest."
