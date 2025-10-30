# Chat Preview - Testing Guide

**Date:** October 30, 2025  
**Status:** Ready for testing ✅

---

## Access URLs

### Frontend (Chat Interface)
**URL:** https://3300-i3ays1688pwzsuc0di4va-35ee5faf.manusvm.computer

**What you see:**
- Welcome screen with Insite logo
- Chat input: "What are you looking for in snowboard?"
- 3 starter prompts:
  - "Show me popular snowboard"
  - "I'm shopping around $10–$2630"
  - "Do you carry Insite-intellgience snowboard?"

### Backend API
**URL:** https://4000-i3ays1688pwzsuc0di4va-35ee5faf.manusvm.computer  
**Health:** https://4000-i3ays1688pwzsuc0di4va-35ee5faf.manusvm.computer/healthz

---

## Current Configuration

### Shop Details
- **Shop:** `insite-intellgience.myshopify.com`
- **Client Key:** `dev-client-key-123`
- **Product Category:** Snowboards

### Backend Status
- ✅ Running on port 4000
- ✅ Health check: `{"status":"ok"}`
- ✅ Routes available:
  - `/api/chat` - Structured chat (JSON)
  - `/api/chat-natural` - Natural language chat
  - `/api/events` - Analytics events
  - `/theme` - Theme configuration

### Frontend Status
- ✅ Running on port 3300
- ✅ Connected to backend API
- ✅ Chat interface loaded
- ✅ Dark mode toggle available

---

## What to Test

### 1. Basic Conversation Flow

**Test queries:**
```
"Show me popular snowboard"
"I'm shopping around $100"
"Do you carry Burton snowboards?"
"What's the best snowboard for beginners?"
"I need a snowboard for powder"
```

**What to analyze:**
- Response quality (natural, helpful)
- Product recommendations (relevant, accurate)
- Conversation flow (smooth, contextual)
- Response time (should be <2 seconds)

### 2. Budget-Based Queries

**Test queries:**
```
"I have $500 to spend"
"Show me snowboards under $300"
"What's your most expensive snowboard?"
"I'm looking for mid-range options"
```

**What to analyze:**
- Price filtering accuracy
- Product suggestions within budget
- Upsell/downsell logic
- Price formatting

### 3. Brand/Style Queries

**Test queries:**
```
"Do you have Burton boards?"
"Show me all-mountain snowboards"
"I need a freestyle board"
"What brands do you carry?"
```

**What to analyze:**
- Brand recognition
- Style/category filtering
- Product attributes understanding
- Inventory awareness

### 4. Comparison Queries

**Test queries:**
```
"Compare these two boards"
"What's the difference between X and Y?"
"Which is better for beginners?"
"Show me similar options"
```

**What to analyze:**
- Comparison logic
- Feature highlighting
- Recommendation reasoning
- Clarity of differences

### 5. Clarification & Follow-ups

**Test queries:**
```
User: "I need a snowboard"
Bot: (asks clarifying questions)
User: "For powder riding"
Bot: (narrows down)
User: "Around $400"
Bot: (shows filtered results)
```

**What to analyze:**
- Clarifying question quality
- Context retention across turns
- Progressive narrowing
- Memory of previous answers

### 6. Edge Cases

**Test queries:**
```
"I don't know what I want"
"Show me everything"
"Do you have skis?" (wrong category)
"What's your return policy?" (non-product)
"I'm just browsing"
```

**What to analyze:**
- Graceful handling of vague queries
- Guidance for undecided customers
- Out-of-scope query handling
- Fallback responses

---

## What to Look For

### Response Quality ✅

**Good responses:**
- Natural, conversational tone
- Specific product recommendations
- Relevant details (price, features, availability)
- Clear next steps

**Bad responses:**
- Generic, robotic language
- Irrelevant products
- Missing key information
- Confusing or unclear

### Conversation Flow ✅

**Good flow:**
- Remembers context from previous messages
- Asks clarifying questions when needed
- Progressively narrows down options
- Smooth transitions between topics

**Bad flow:**
- Forgets previous context
- Repeats questions
- Jumps between topics randomly
- Doesn't acknowledge user input

### Product Recommendations ✅

**Good recommendations:**
- Match user criteria (budget, style, brand)
- Include relevant details (price, features)
- Ranked by relevance
- Include images/links

**Bad recommendations:**
- Don't match criteria
- Missing key details
- Random order
- Broken links/images

### Error Handling ✅

**Good handling:**
- Graceful fallbacks for unclear queries
- Helpful error messages
- Suggests alternatives
- Maintains conversation

**Bad handling:**
- Crashes or shows errors
- Unhelpful messages
- Ends conversation abruptly
- Loses context

---

## Testing Checklist

### Basic Functionality
- [ ] Chat input accepts text
- [ ] Send button works
- [ ] Starter prompts are clickable
- [ ] Messages appear in chat history
- [ ] Bot responds within 2 seconds
- [ ] Dark mode toggle works
- [ ] Cart icon shows count

### Conversation Quality
- [ ] Responses are natural and helpful
- [ ] Product recommendations are relevant
- [ ] Context is retained across turns
- [ ] Clarifying questions are asked when needed
- [ ] Follow-up queries work correctly

### Product Filtering
- [ ] Budget filters work correctly
- [ ] Brand filters work correctly
- [ ] Style/category filters work correctly
- [ ] Multiple filters can be combined
- [ ] "No results" is handled gracefully

### Edge Cases
- [ ] Vague queries are handled well
- [ ] Out-of-scope queries are handled
- [ ] Very long messages work
- [ ] Special characters don't break it
- [ ] Multiple rapid messages work

### Performance
- [ ] Initial load is fast (<2s)
- [ ] Responses are fast (<2s)
- [ ] No lag or freezing
- [ ] Smooth scrolling
- [ ] No memory leaks (test with many messages)

---

## Known Issues

### Database Schema Mismatch (BLOCKING)
**Issue:** Conversation tests are blocked by database schema mismatch.

**Details:**
- Shops table uses `shop_domain` column
- Some code expects `domain` column
- 44 conversation tests failing

**Impact:**
- Chat may not work correctly
- Product recommendations may fail
- Conversation context may be lost

**Fix Required:**
```sql
ALTER TABLE shops ADD COLUMN IF NOT EXISTS shop_domain TEXT;
-- OR
ALTER TABLE shops RENAME COLUMN domain TO shop_domain;
```

**Priority:** HIGH - Must fix before production

### No Real Product Data
**Issue:** Using mock/test data for snowboards.

**Impact:**
- Limited product variety
- May not match real inventory
- Prices may be unrealistic

**Fix:** Load real product data from client's catalog

---

## How to Report Issues

### For Each Issue, Note:

1. **What you did:**
   - Exact query you typed
   - Any previous context

2. **What happened:**
   - Bot's response
   - Any errors in console
   - Screenshots if visual

3. **What you expected:**
   - Ideal response
   - Why current response is wrong

4. **Severity:**
   - Critical (blocks usage)
   - High (major issue)
   - Medium (annoying but works)
   - Low (minor polish)

### Example Issue Report:

```
ISSUE: Bot recommends out-of-budget products

What I did:
- Typed: "I have $200 to spend"
- Bot showed products
- All products were $400+

What happened:
- Bot said "Here are some options"
- Showed 3 snowboards: $450, $520, $380
- All above my budget

What I expected:
- Products under $200
- Or message saying "No products in that range"

Severity: HIGH
```

---

## Testing Workflow

### Session 1: Basic Flow (15 min)
1. Open chat interface
2. Try 3 starter prompts
3. Follow up with related queries
4. Note response quality

### Session 2: Filtering (15 min)
1. Test budget filters
2. Test brand filters
3. Test style filters
4. Combine multiple filters

### Session 3: Edge Cases (15 min)
1. Try vague queries
2. Try out-of-scope queries
3. Try very specific queries
4. Try rapid-fire messages

### Session 4: Conversation Flow (15 min)
1. Have a full conversation (10+ turns)
2. Test context retention
3. Test clarification questions
4. Test follow-ups

### Session 5: Analysis (30 min)
1. Review all responses
2. Identify patterns (good/bad)
3. Document issues
4. Prioritize fixes

**Total:** ~90 minutes for comprehensive testing

---

## Quick Start

1. **Open chat:** https://3300-i3ays1688pwzsuc0di4va-35ee5faf.manusvm.computer
2. **Try a starter prompt:** Click "Show me popular snowboard"
3. **Analyze response:** Is it helpful? Natural? Relevant?
4. **Follow up:** Ask related questions
5. **Document findings:** Note what works and what doesn't

---

## Success Criteria

### Minimum Viable
- [ ] Chat loads and accepts input
- [ ] Bot responds to basic queries
- [ ] Product recommendations appear
- [ ] Conversation doesn't crash

### Good Experience
- [ ] Responses are natural and helpful
- [ ] Products match user criteria
- [ ] Context is retained
- [ ] Clarifying questions are asked

### Excellent Experience
- [ ] Responses feel human-like
- [ ] Recommendations are spot-on
- [ ] Conversation flows smoothly
- [ ] Edge cases handled gracefully
- [ ] Users can complete purchase journey

---

## Next Steps After Testing

1. **Document findings** - Create issue list
2. **Prioritize fixes** - Critical → High → Medium → Low
3. **Fix database schema** - Unblock conversation tests
4. **Load real data** - Replace mock products
5. **Iterate** - Fix issues and re-test
6. **Deploy** - Ship to production

---

**Ready to test!** Open the URL and start chatting. Take notes on what works well and what needs improvement.
