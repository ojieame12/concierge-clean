# Current Status - Natural Conversation System

## What Works ✅

### 1. Natural Conversation
- **Educational responses:** "what are snowboards?" → natural explanation
- **Off-topic chat:** Can handle weather, sports, general questions
- **Gemini controls flow:** No rigid patterns or forced modes

### 2. Response Structure
- **Proper segments:** Uses `{type: 'narrative', text: '...'}`
- **Product format:** Uses `{type: 'products', items: [ProductCard[]]}`
- **Clarifier format:** Uses `{type: 'ask'}` + `{type: 'options'}`
- **Frontend compatible:** Matches expected TypeScript interfaces

### 3. Manual Search Triggering
- **Pattern detection:** Detects "show me", "find", "looking for", etc.
- **Automatic search:** Triggers search before LLM response
- **Context injection:** Adds search results to conversation

## What Doesn't Work ❌

### 1. Product Search Returns Empty
**Problem:** Search function returns no products

**Root Cause:** Database schema mismatch
- Error: `column products.price does not exist`
- The `products` table doesn't have a `price` column
- Price is in `product_variants` table

**Impact:** Can't recommend products even though search is triggered

### 2. Gemini Function Calling
**Problem:** Gemini 2.0 Flash Exp doesn't reliably call functions

**Evidence:**
```
[Orchestrator] Function call detected: none
```

**Workaround:** Manual search triggering (implemented)

**Status:** Not critical since manual triggering works

## Architecture

### Flow
```
User: "show me snowboards"
  ↓
Frontend: POST /api/chat-natural-v2
  ↓
Route: Extract shop, messages
  ↓
Orchestrator: 
  1. Detect "show me" pattern
  2. Call tools.searchProducts()
  3. Add results to context
  4. Send to Gemini
  5. Gemini responds with JSON
  6. Parse and format segments
  ↓
Route: Stream segments to frontend
  ↓
Frontend: Render segments
```

### Files
- `backend/src/core/conversation/orchestrator.ts` - Main logic
- `backend/src/core/conversation/tools.ts` - Tool implementations
- `backend/src/routes/chat-natural-v2.ts` - API endpoint
- `frontend/src/hooks/useTimelineConversation.ts` - Frontend hook

## Next Steps

### Priority 1: Fix Product Search
**Option A: Fix the search query**
Update `tools.ts` to join with `product_variants` table properly

**Option B: Add price column to products**
```sql
ALTER TABLE products ADD COLUMN price DECIMAL;
UPDATE products p SET price = (
  SELECT MIN(price) FROM product_variants WHERE product_id = p.id
);
```

### Priority 2: Test End-to-End
Once products are searchable:
1. Test "show me snowboards" → should show 2-3 products
2. Test "what are snowboards" → should explain naturally
3. Test "how's the weather" → should chat naturally
4. Test follow-up questions → should maintain context

### Priority 3: Improve Search Triggering
Current regex is basic. Could improve with:
- More patterns (e.g., "I want", "I need", "looking for")
- Category detection (e.g., "snowboards", "jackets")
- Price extraction (e.g., "$100-$500")

## Test URLs

**Frontend:** https://3300-i3ays1688pwzsuc0di4va-35ee5faf.manusvm.computer

**Backend API:**
```bash
curl -X POST http://localhost:4000/api/chat-natural-v2 \
  -H "Content-Type: application/json" \
  -H "x-concierge-client-key: dev-client-key-123" \
  -d '{
    "shopDomain": "insite-intellgience.myshopify.com",
    "messages": [{"role": "user", "content": "what are snowboards"}]
  }'
```

## Summary

**The natural conversation system is 80% complete:**
- ✅ Natural responses work
- ✅ Response structure is correct
- ✅ Frontend integration works
- ✅ Manual search triggering works
- ❌ Product search returns empty (database issue)

**Once the database is fixed, the system will be fully functional.**
