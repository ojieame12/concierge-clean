# Dead-End Scenario Tests

**Purpose:** Validate inventory-aware recovery and graceful handling of impossible requests.

---

## Overview

These tests ensure the natural conversation pipeline handles challenging scenarios with empathy, honesty, and tasteful alternatives—not robotic apologies or pushy sales tactics.

---

## Test Scenarios

### CONV-RUN-02: Out-of-Stock Variant Recovery

**Scenario:** User requests specific variant that's out of stock  
**Product:** Fleet MarathonMax Black Size 9 (OOS)  
**Expected Behavior:**

1. **Empathetic Acknowledgment**
   - Mention stock issue naturally (not robotically)
   - No "I apologize for the inconvenience" boilerplate
   - Use contractions and natural language

2. **Recovery Strategies** (at least one):
   - Same model in different variant (Grey Size 10)
   - Tasteful upsell within 20% of price ($140 → max $168)
   - Clear reasoning for each alternative

3. **Action Suggestions:**
   - "Notify me when back in stock"
   - "Adjust filters" or "Other options"
   - Not pushy or salesy

4. **Quality Checks:**
   - ✅ No robotic phrases
   - ✅ Uses contractions
   - ✅ Sentence variety
   - ✅ Max 1 exclamation per response
   - ✅ Explains WHY alternatives are good

**Validation:**
- Naturalness score ≥ 4.0
- Recommendations score ≥ 4.0
- 1-3 products shown
- Reasoning includes "because", "since", "offers", etc.

---

### CONV-SNOW-02: Dead-End Budget Scenario

**Scenario:** User requests product with unrealistic budget  
**Request:** "4K snowboard for under $250"  
**Reality:** Cheapest board is $329 (ParkPop 148, currently OOS) or $389 (Snowline Nova)  
**Expected Behavior:**

1. **Clarification First** (not immediate rejection)
   - Ask about priorities or use case
   - "What's most important to you?"
   - "Are you a beginner or experienced?"
   - Not dismissive or discouraging

2. **Honest Budget Discussion**
   - Mention price openly (not avoid the topic)
   - Explain VALUE, not just cost
   - "The closest option is $329, but here's why it's worth it..."

3. **Nearest Match + Optional Upsell:**
   - Show 1-3 products
   - Nearest spec match within adjusted budget
   - Optional upsell with 2+ clear advantages
   - Explain tradeoffs between options

4. **Empathetic Tone:**
   - No salesy language ("amazing deal", "limited time")
   - No pressure tactics
   - Friendly expert, not pushy salesperson

**Quality Checks:**
- ✅ Asks clarifying questions
- ✅ Mentions budget/price honestly
- ✅ Explains value (forgiving, beginner-friendly, etc.)
- ✅ Mentions specific features (flex, profile, rocker)
- ✅ Explains WHY one might be better
- ✅ No salesy language
- ✅ Uses contractions
- ✅ Sentence variety

**Validation:**
- Clarification score ≥ 4.0
- Naturalness score ≥ 4.0
- Recommendations score ≥ 4.0
- 1-3 products shown
- At least one affordable option ($300-$400)

---

## Key Principles

### 1. Empathy Over Apology
**Bad:** "I apologize for the inconvenience, but that item is currently unavailable."  
**Good:** "The black size 9 is sold out right now, but I've got a couple options that might work even better."

### 2. Clarify Before Rejecting
**Bad:** "We don't have any boards under $250."  
**Good:** "What's bringing you to snowboarding? If you're just starting out, I can explain why the $329 option is actually perfect for beginners."

### 3. Value Over Price
**Bad:** "This costs $329."  
**Good:** "At $329, the ParkPop 148 is catch-free and super forgiving—exactly what you want when learning."

### 4. Tasteful Upsells
**Bad:** "For just $50 more, you can get the premium model!"  
**Good:** "The Snowline Nova at $389 has a more versatile profile—works great on groomers and in powder, while the ParkPop is more park-focused."

### 5. Natural Language
**Bad:** "I am unable to locate products matching your criteria."  
**Good:** "I don't see anything hitting that price point, but let me show you what's close."

---

## Recovery Strategies

### Stock-Aware Ranking
1. Prefer in-stock products
2. Keep OOS only if explicitly requested by name
3. Mention stock status naturally

### Dead-End Recovery Order
1. **Sibling variant** (same model, different color/size)
2. **Nearest spec match** within budget
3. **Tasteful upsell** (≤20% over budget, dominates on ≥2 features)

### Action Suggestions
- Always include "Notify me" for OOS items
- Suggest "Adjust filters" with one gentle relaxation
- Never pressure or create false urgency

---

## Test Execution

### Run Dead-End Tests Only
```bash
npm run test:conversations -- --testNamePattern="CONV-RUN-02|CONV-SNOW-02"
```

### Run All Conversation Tests (Sequential)
```bash
npm run test:conversations
```

**Note:** Tests run sequentially (`maxWorkers: 1`) to avoid Gemini API rate limits.

---

## Expected Output

### Successful Test Run
```
PASS  tests/conversations/CONV-RUN-02.out-of-stock-variant.test.ts
  CONV-RUN-02: Out-of-Stock Variant Recovery
    ✓ should handle specific out-of-stock variant gracefully (5234ms)
    ✓ should maintain natural conversation tone during recovery (3421ms)
    ✓ should score well on naturalness (2156ms)
    ✓ should score well on recommendations quality (2089ms)

PASS  tests/conversations/CONV-SNOW-02.dead-end-budget.test.ts
  CONV-SNOW-02: Dead-End Budget Scenario
    ✓ should clarify needs when budget is unrealistic (4532ms)
    ✓ should offer nearest match with honest budget discussion (3876ms)
    ✓ should provide tasteful upsell with clear advantages (3234ms)
    ✓ should maintain empathetic tone throughout (1987ms)
    ✓ should score well on clarification quality (2145ms)
    ✓ should score well on naturalness (2098ms)
    ✓ should score well on recommendations despite budget constraint (2176ms)

Test Suites: 2 passed, 2 total
Tests:       11 passed, 11 total
Time:        32.948s
```

### Quality Scores
- **Naturalness:** ≥ 4.0 / 5.0
- **Recommendations:** ≥ 4.0 / 5.0
- **Clarification:** ≥ 4.0 / 5.0

---

## Debugging

### View Full Conversations
Each test logs the full conversation in `afterAll()`:

```
=== Full Conversation ===

[1] USER:
I want the Fleet MarathonMax in black, size 9

[2] ASSISTANT:
The MarathonMax in black size 9 is sold out right now, but I've got the grey in size 10 available...
```

### Check Lint Violations
```typescript
const lintResults = lintPersona(response.text);
console.log('Violations:', lintResults.violations);
```

### Check Judge Scores
```typescript
const score = await judgeNaturalness(conversation);
console.log('Score:', score.score);
console.log('Reasoning:', score.reasoning);
```

---

## Integration with CI/CD

These tests run automatically in GitHub Actions:

1. **Postgres seeded** with test data
2. **Tests run sequentially** (maxWorkers: 1)
3. **Quality gates checked** (scores ≥ 4.0)
4. **Results posted** to PR comments

---

## What These Tests Prove

✅ **Empathy:** System handles disappointment gracefully  
✅ **Honesty:** Discusses budget/stock openly, not evasively  
✅ **Intelligence:** Clarifies before rejecting  
✅ **Taste:** Upsells with reasoning, not pressure  
✅ **Naturalness:** Sounds human, not robotic  
✅ **Value-Focus:** Explains WHY, not just WHAT  

**These are the conversations that build trust.**

---

**Created:** October 29, 2025  
**Status:** Ready for testing  
**Next:** Run tests with seeded database
