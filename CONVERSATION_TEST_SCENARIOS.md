# Conversation Test Scenarios

## Goal
Prove that Gemini controls the conversation flow with proper store intelligence context, responding flexibly (not hardcoded) with structured outputs that match the UI expectations.

## Key Requirements

### Response Structure
Every response must have:
- **Main Lead**: 1-2 sentence concierge-tone response
- **Action Detail**: 2-3 sentence max summary with hints
- **Segments**: Proper typed segments (narrative, products, options, etc.)

### Context Awareness
System must know when to use:
- **Gemini only**: Greetings, general knowledge, small talk
- **Gemini + Store Context**: Product recommendations, inventory, policies

---

## Test Scenario 1: Cold Start → Greeting

### Turn 1: User Greeting
**User Input:** "Hi" or "Hello"

**Expected Response:**
```json
{
  "mainLead": "Hey there! Welcome to [Store Name].",
  "actionDetail": "I'm here to help you find exactly what you need. Whether you're browsing or looking for something specific, just let me know!",
  "segments": [
    {"type": "narrative", "text": "Hey there! Welcome to [Store Name]. I'm here to help you find exactly what you need. Whether you're browsing or looking for something specific, just let me know!"}
  ]
}
```

**Validation:**
- ✅ Uses Gemini only (no store context needed)
- ✅ Warm, concierge tone
- ✅ 1-2 sentence main lead
- ✅ 2-3 sentence action detail
- ✅ No products, no clarifiers

---

## Test Scenario 2: Educational Question → Natural Response

### Turn 1: General Knowledge
**User Input:** "What are snowboards?"

**Expected Response:**
```json
{
  "mainLead": "Snowboards are boards you strap boots to so you can slide down snowy hills!",
  "actionDetail": "They're super fun for carving turns and catching air. Different boards work better for different styles—some are great for tricks, others for speed. Want to know what makes a good snowboard, or are you looking for one?",
  "segments": [
    {"type": "narrative", "text": "Snowboards are boards you strap boots to so you can slide down snowy hills! They're super fun for carving turns and catching air."},
    {"type": "narrative", "text": "Different boards work better for different styles—some are great for tricks, others for speed. Want to know what makes a good snowboard, or are you looking for one?"}
  ]
}
```

**Validation:**
- ✅ Uses Gemini only (educational, no products)
- ✅ Natural, conversational tone
- ✅ Hints at pivot to store ("are you looking for one?")
- ✅ No forced product search

---

## Test Scenario 3: Product Interest → Clarification Flow

### Turn 1: Initial Product Request
**User Input:** "What kind of snowboards would be good for a beginner?"

**Expected Response:**
```json
{
  "mainLead": "Great question! Beginner boards are usually softer and more forgiving.",
  "actionDetail": "To find the perfect match, it helps to know a bit more about your riding style and preferences.",
  "segments": [
    {"type": "narrative", "text": "Great question! Beginner boards are usually softer and more forgiving. To find the perfect match, it helps to know a bit more about your riding style and preferences."},
    {"type": "ask", "text": "What kind of terrain are you most excited to ride?"},
    {"type": "options", "style": "quick_replies", "items": [
      {"id": "opt_1", "label": "Groomed runs", "value": "groomed"},
      {"id": "opt_2", "label": "Powder", "value": "powder"},
      {"id": "opt_3", "label": "Park/tricks", "value": "park"},
      {"id": "opt_4", "label": "Something else", "value": "_something_else"}
    ]}
  ]
}
```

**Validation:**
- ✅ Uses Gemini + Store Context (preparing to recommend)
- ✅ Asks ONE clarifying question
- ✅ Provides 3 options + "Something else"
- ✅ Concierge tone, not robotic

### Turn 2: User Selects Clarifier
**User Input:** [Taps "Groomed runs"]

**Context:** Previous messages + selected option

**Expected Response:**
```json
{
  "mainLead": "Perfect! Groomed runs are great for learning.",
  "actionDetail": "One more thing—what's your budget range?",
  "segments": [
    {"type": "narrative", "text": "Perfect! Groomed runs are great for learning. One more thing—what's your budget range?"},
    {"type": "options", "style": "quick_replies", "items": [
      {"id": "opt_1", "label": "Under $300", "value": "budget"},
      {"id": "opt_2", "label": "$300-$500", "value": "mid"},
      {"id": "opt_3", "label": "$500+", "value": "premium"},
      {"id": "opt_4", "label": "Something else", "value": "_something_else"}
    ]}
  ]
}
```

**Validation:**
- ✅ Remembers previous context (groomed runs)
- ✅ Asks SECOND clarifying question
- ✅ Still concierge tone
- ✅ Building toward recommendation

### Turn 3: User Selects Second Clarifier
**User Input:** [Taps "$300-$500"]

**Context:** Previous messages + terrain + budget

**Expected Response:**
```json
{
  "mainLead": "Got it! Here are my top picks for beginner boards in your range.",
  "actionDetail": "These boards are forgiving, stable, and perfect for groomed runs.",
  "segments": [
    {"type": "narrative", "text": "Got it! Here are my top picks for beginner boards in your range. These boards are forgiving, stable, and perfect for groomed runs."},
    {"type": "products", "items": [
      {
        "id": "prod_1",
        "title": "Burton Custom",
        "price": 549.99,
        "currency": "USD",
        "image": "...",
        "vendor": "Burton",
        "why_chips": ["Great for beginners", "Stable on groomers", "Forgiving flex"],
        "top_pick": true
      },
      {
        "id": "prod_2",
        "title": "Capita DOA",
        "price": 499.99,
        "currency": "USD",
        "image": "...",
        "vendor": "Capita",
        "why_chips": ["Versatile", "Good value", "Easy to control"],
        "top_pick": false
      }
    ], "layout": "default"}
  ]
}
```

**Validation:**
- ✅ Remembers full context (beginner, groomed, $300-$500)
- ✅ Shows 2-3 products max
- ✅ Each product has "why" reasons
- ✅ Top pick indicated
- ✅ Proper product segment structure

---

## Test Scenario 4: Product Interaction → Drawer Flow

### Turn 1: User Taps Product Card
**User Action:** [Taps "Burton Custom" product card]

**Expected:** Product drawer opens (frontend handles this)

### Turn 2: User Taps "Ask for more information"
**User Action:** [Taps "Ask for more information" in drawer]

**Expected Response:**
```json
{
  "mainLead": "What would you like to know about the Burton Custom?",
  "actionDetail": "I can tell you about its specs, how it rides, or compare it to other boards.",
  "segments": [
    {"type": "narrative", "text": "What would you like to know about the Burton Custom? I can tell you about its specs, how it rides, or compare it to other boards."}
  ]
}
```

**Validation:**
- ✅ Contextual to selected product
- ✅ Invites follow-up question
- ✅ Concierge tone

### Turn 3: User Asks Follow-Up
**User Input:** "Is it good for powder too?"

**Expected Response:**
```json
{
  "mainLead": "The Burton Custom can handle powder, but it's not optimized for it.",
  "actionDetail": "It's a directional twin, so it's more versatile than a pure powder board. If you want something that floats better in deep snow, I can show you boards with more setback and rocker.",
  "segments": [
    {"type": "narrative", "text": "The Burton Custom can handle powder, but it's not optimized for it. It's a directional twin, so it's more versatile than a pure powder board."},
    {"type": "narrative", "text": "If you want something that floats better in deep snow, I can show you boards with more setback and rocker."}
  ]
}
```

**Validation:**
- ✅ Remembers product context
- ✅ Provides honest, helpful answer
- ✅ Offers alternative if needed

### Turn 4: User Adds to Cart
**User Action:** [Taps "Add to cart"]

**Expected Response:**
```json
{
  "mainLead": "Nice choice! The Burton Custom is in your cart.",
  "actionDetail": "Want to pair it with bindings, boots, or anything else? Or are you all set?",
  "segments": [
    {"type": "narrative", "text": "Nice choice! The Burton Custom is in your cart. Want to pair it with bindings, boots, or anything else? Or are you all set?"}
  ]
}
```

**Validation:**
- ✅ Confirms action
- ✅ Suggests complementary products
- ✅ Gives user control to continue or stop

---

## Test Scenario 5: Cross-Sell → New Product Search

### Turn 1: User Wants Complementary Product
**User Input:** "I need to pair this with something else as a gift"

**Expected Response:**
```json
{
  "mainLead": "Great idea! What are you thinking—bindings, boots, goggles, or something else?",
  "actionDetail": "I can help you find the perfect match for the Burton Custom.",
  "segments": [
    {"type": "narrative", "text": "Great idea! What are you thinking—bindings, boots, goggles, or something else? I can help you find the perfect match for the Burton Custom."}
  ]
}
```

**Validation:**
- ✅ Remembers previous purchase (Burton Custom)
- ✅ Suggests relevant categories
- ✅ Invites clarification

### Turn 2: User Clarifies
**User Input:** "Bindings"

**Expected Response:**
```json
{
  "mainLead": "Perfect! Let me find bindings that work well with the Burton Custom.",
  "actionDetail": "What's your riding style—freestyle, all-mountain, or freeride?",
  "segments": [
    {"type": "narrative", "text": "Perfect! Let me find bindings that work well with the Burton Custom. What's your riding style—freestyle, all-mountain, or freeride?"},
    {"type": "options", "style": "quick_replies", "items": [
      {"id": "opt_1", "label": "Freestyle", "value": "freestyle"},
      {"id": "opt_2", "label": "All-mountain", "value": "all_mountain"},
      {"id": "opt_3", "label": "Freeride", "value": "freeride"},
      {"id": "opt_4", "label": "Something else", "value": "_something_else"}
    ]}
  ]
}
```

**Validation:**
- ✅ Starts new product search
- ✅ Maintains context (Burton Custom)
- ✅ Asks relevant clarifier
- ✅ Natural flow, not starting over

---

## Test Scenario 6: Off-Topic → Graceful Pivot

### Turn 1: User Asks Off-Topic Question
**User Input:** "How's the weather today?"

**Expected Response:**
```json
{
  "mainLead": "I'm doing great, thanks for asking!",
  "actionDetail": "I'm here to help you find awesome gear. What are you shopping for today?",
  "segments": [
    {"type": "narrative", "text": "I'm doing great, thanks for asking! I'm here to help you find awesome gear. What are you shopping for today?"}
  ]
}
```

**Validation:**
- ✅ Responds naturally to off-topic
- ✅ ONE sentence response
- ✅ Pivots back to store (if relevant)
- ✅ Doesn't force products

---

## Test Scenario 7: "Something Else" Inline Input

### Turn 1: User Taps "Something Else"
**User Action:** [Taps "Something else" option]

**Expected:** Inline input opens (frontend handles this)

### Turn 2: User Types Custom Response
**User Input:** "I want a board for backcountry splitboarding"

**Context:** Previous clarifier question + custom input

**Expected Response:**
```json
{
  "mainLead": "Ah, backcountry splitboarding! That's a different beast.",
  "actionDetail": "You'll want a splitboard, not a regular snowboard. Let me show you some options designed for touring and powder.",
  "segments": [
    {"type": "narrative", "text": "Ah, backcountry splitboarding! That's a different beast. You'll want a splitboard, not a regular snowboard."},
    {"type": "narrative", "text": "Let me show you some options designed for touring and powder."},
    {"type": "products", "items": [...]}
  ]
}
```

**Validation:**
- ✅ Handles unexpected input gracefully
- ✅ Understands context (splitboard vs snowboard)
- ✅ Adapts recommendation
- ✅ Shows relevant products

---

## Test Scenario 8: Zero Results → Helpful Response

### Turn 1: User Asks for Unavailable Product
**User Input:** "Do you have any snowboards under $100?"

**Expected Response:**
```json
{
  "mainLead": "I don't have any snowboards under $100 right now.",
  "actionDetail": "Quality boards typically start around $300. Would you like to see our most affordable options, or should I notify you if something in your range comes in?",
  "segments": [
    {"type": "narrative", "text": "I don't have any snowboards under $100 right now. Quality boards typically start around $300."},
    {"type": "narrative", "text": "Would you like to see our most affordable options, or should I notify you if something in your range comes in?"},
    {"type": "options", "style": "quick_replies", "items": [
      {"id": "opt_1", "label": "Show affordable options", "value": "show_affordable"},
      {"id": "opt_2", "label": "Notify me", "value": "notify"},
      {"id": "opt_3", "label": "Something else", "value": "_something_else"}
    ]}
  ]
}
```

**Validation:**
- ✅ Honest about availability
- ✅ Explains why (quality threshold)
- ✅ Offers alternatives
- ✅ Doesn't force products

---

## Test Scenario 9: Retry CTA → New Clarification Round

### Turn 1: User Clicks "Retry" After Seeing Products
**User Action:** [Clicks "Retry" CTA]

**Expected Response:**
```json
{
  "mainLead": "No problem! Let's find something better.",
  "actionDetail": "What didn't work about those options?",
  "segments": [
    {"type": "narrative", "text": "No problem! Let's find something better. What didn't work about those options?"},
    {"type": "options", "style": "quick_replies", "items": [
      {"id": "opt_1", "label": "Too expensive", "value": "too_expensive"},
      {"id": "opt_2", "label": "Wrong style", "value": "wrong_style"},
      {"id": "opt_3", "label": "Not what I'm looking for", "value": "not_right"},
      {"id": "opt_4", "label": "Something else", "value": "_something_else"}
    ]}
  ]
}
```

**Validation:**
- ✅ Starts new clarification round
- ✅ Asks what went wrong
- ✅ Maintains helpful tone
- ✅ Doesn't repeat same products

---

## Implementation Requirements

### Test Framework
```typescript
interface ConversationTest {
  name: string;
  turns: Turn[];
  expectedOutcomes: Validation[];
}

interface Turn {
  userInput: string | UserAction;
  context: ConversationContext;
  expectedResponse: ExpectedResponse;
}

interface ExpectedResponse {
  mainLead: string; // 1-2 sentences
  actionDetail: string; // 2-3 sentences max
  segments: Segment[];
  mode: 'chat' | 'recommend';
  usesStoreContext: boolean;
}

interface Validation {
  rule: string;
  passes: boolean;
  message?: string;
}
```

### Validators
1. **Structure Validator**: Checks segments match TypeScript types
2. **Length Validator**: Ensures main lead (1-2 sentences), action detail (2-3 sentences)
3. **Tone Validator**: Checks for concierge tone (warm, helpful, not robotic)
4. **Context Validator**: Verifies system remembers previous turns
5. **Store Context Validator**: Confirms when store data is used vs. Gemini only

### Success Criteria
- ✅ All 9 scenarios pass
- ✅ Response structure matches frontend expectations
- ✅ Gemini controls flow (not hardcoded)
- ✅ Proper context awareness (Gemini vs. Gemini + Store)
- ✅ Natural, conversational tone
- ✅ No forced patterns or rigid routing

---

## Next Steps
1. Implement test framework
2. Create validators
3. Run all scenarios
4. Document results
5. Fix any failures
6. Prove system is flexible and functional
