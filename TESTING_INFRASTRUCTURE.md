# Testing Infrastructure for Natural Conversations

## Phase 2: Testing Infrastructure (COMPLETED)

**Date:** October 29, 2025  
**Goal:** Build comprehensive testing infrastructure to validate natural conversation quality with human-ness linting, LLM-as-Judge scoring, and golden conversation scenarios

---

## What We Built

### 1. **Conversation Test Harness** (`tests/utils/convoHarness.ts`)

A complete framework for simulating and testing multi-turn conversations.

**Features:**
- ✅ Session management with conversation history
- ✅ Structured response parsing (segments, products, clarifiers)
- ✅ Automatic product and question extraction
- ✅ Final pick detection
- ✅ Multi-turn conversation scripts
- ✅ Helper functions for analysis

**Example Usage:**
```typescript
import { startSession, send, countClarifiers } from '../utils/convoHarness';

// Start conversation
const session = await startSession({ persona: 'friendly_expert' });

// Send message
const response = await send(session, 'I need running shoes');

// Extract results
console.log(response.text);           // All narrative text
console.log(response.clarifiers);     // Questions asked
console.log(response.shortlist);      // Products shown (2-3)
console.log(response.finalPick);      // Recommended product
console.log(response.options);        // Quick reply options
```

**Key Functions:**
- `startSession()` - Initialize conversation
- `send()` - Send message and get response
- `runConversation()` - Execute multi-turn script
- `getAllProducts()` - Extract all products mentioned
- `countClarifiers()` - Count total questions asked
- `getConversationLength()` - Get turn count

---

### 2. **Human-ness Linter** (`tests/utils/personaLinter.ts`)

Fast, deterministic checks to catch robotic output before LLM-as-Judge.

**Checks Performed:**

✅ **Contractions**
- Detects: "I'll", "you're", "that's", "can't", etc.
- Violation: No contractions found (sounds too formal)
- Warning: <2 contractions (might sound stiff)

✅ **Sentence Variety**
- Calculates variance in sentence length
- Violation: Variance <8 (sounds monotonous)
- Checks for overly long sentences (>50 words)

✅ **Exclamation Marks**
- Default limit: 1 per response
- Violation: >1 exclamation (sounds overly excited)

✅ **Robotic Boilerplate**
- Detects: "As an AI", "I am unable to", "Based on the data provided"
- Violation: Any robotic phrase found

✅ **Boring Openers**
- Detects: "Sure,", "Certainly,", "Of course,"
- Warning: Generic opener (try varying)

✅ **Repetitive Words**
- Counts word frequency
- Warning: Same word used >3 times (excluding common words)

**Example Usage:**
```typescript
import { assertPersonaChecks, checkNaturalLanguage } from '../utils/personaLinter';

// Assert all checks pass (throws if violations)
assertPersonaChecks(response.text, { allowExclaim: 1 });

// Get detailed results
const result = personaChecks(response.text);
console.log(result.passed);           // true/false
console.log(result.violations);       // Hard failures
console.log(result.warnings);         // Soft warnings
console.log(result.stats);            // Metrics
```

**Stats Provided:**
- Contraction count
- Exclamation count
- Sentence variance
- Average sentence length
- Sentence count

---

### 3. **LLM-as-Judge Scoring** (`tests/utils/judges.ts`)

Gemini Flash scores conversation quality on specific rubrics (1-5 scale).

**Judges Implemented:**

#### **Naturalness Judge** (`judgeNaturalness`)
Scores warmth and conversational quality.

**Scoring Guide:**
- **5**: Exceptionally natural, warm, conversational (sounds like a friend)
- **4**: Natural and friendly with minor stiffness
- **3**: Somewhat natural but noticeable robotic elements
- **2**: Mostly robotic with occasional natural moments
- **1**: Completely robotic, formal, or awkward

**Penalizes:**
- Formal boilerplate
- No contractions
- Repetitive openings
- Generic responses
- Overly formal language

**Rewards:**
- Concise warmth
- Natural contractions
- Varied sentence structure
- Personal touch
- Genuine enthusiasm (not excessive)

#### **Recommendations Judge** (`judgeRecommendations`)
Scores product recommendation quality.

**Scoring Guide:**
- **5**: 2-3 products with detailed, personal reasons citing specific features
- **4**: 2-3 products with good reasons but some generic elements
- **3**: Right count but generic reasons, or wrong count with good reasons
- **2**: Too many products (>3) or very generic reasons
- **1**: No products, or 5+ products with template reasons

**Penalizes:**
- Showing >3 products (choice overload)
- Generic reasons ("Good for beginners")
- No specific features mentioned
- Template-like language

**Rewards:**
- Exactly 2-3 products
- Personal, detailed reasons (2-3 sentences each)
- Specific features cited (price, weight, reviews)
- Clear tradeoffs explained
- References user's specific needs

#### **Clarification Judge** (`judgeClarification`)
Scores clarifying question quality.

**Scoring Guide:**
- **5**: 1-2 thoughtful questions that explain WHY asking
- **4**: 1-2 questions with minor issues
- **3**: Right count but generic, or 3+ questions that are good
- **2**: Too many questions (>3) or very generic
- **1**: No questions when needed, or 5+ questions

**Penalizes:**
- Asking >2 questions at once (overwhelming)
- Generic questions ("What's your budget?")
- No explanation of WHY asking
- Template-like phrasing

**Rewards:**
- 1-2 questions per turn
- Explains WHY asking each question
- Natural, conversational phrasing
- Asks about needs (not product attributes)
- Progressive narrowing

#### **Guidance Judge** (`judgeGuidance`)
Scores off-topic handling and return to goal.

**Scoring Guide:**
- **5**: Perfect balance - warm acknowledgment + smooth return in 1-2 sentences
- **4**: Good balance but slightly long or abrupt
- **3**: Either too friendly (loses focus) or too abrupt (ignores off-topic)
- **2**: Poor handling - ignores off-topic or never returns to goal
- **1**: Completely fails - robotic or totally derailed

**Penalizes:**
- Ignoring off-topic comment
- Being abrupt or dismissive
- Taking >2 sentences to return
- Losing track of goal

**Rewards:**
- Brief, warm acknowledgment (1 sentence)
- Smooth transition back (1 sentence)
- Natural connection between topics
- Maintains rapport

**Example Usage:**
```typescript
import { judgeNaturalness, judgeRecommendations, judgeConversationTurn } from '../utils/judges';

// Judge naturalness
const naturalness = await judgeNaturalness(response.text);
console.log(naturalness.score);       // 4.5
console.log(naturalness.reasons);     // ["Uses natural contractions", ...]

// Judge recommendations
const recommendations = await judgeRecommendations(response.text, products);
console.log(recommendations.score);   // 5.0

// Judge entire turn (runs all applicable judges)
const results = await judgeConversationTurn(
  response.text,
  products,
  questionCount,
  originalGoal
);
console.log(results.overallScore);    // 4.7
```

---

### 4. **Golden Conversation Tests**

End-to-end test scenarios that validate complete conversation flows.

#### **CONV-RUN-01: Marathon Training** (`tests/conversations/CONV-RUN-01.marathon-training.test.ts`)

**Scenario:** User training for first marathon

**Expected Flow:**
1. User: "I need running shoes"
2. AI: Asks about training goal (warm, explains why)
3. User: "Training for a marathon"
4. AI: Asks about road/trail and experience
5. User: "Road, first marathon, 30 miles/week"
6. AI: Shows 2-3 shoes with detailed reasons

**Assertions:**
- ✅ Naturalness ≥ 4.0
- ✅ Clarifier count ≤ 2 per turn
- ✅ Shortlist size = 2-3
- ✅ Final pick present
- ✅ Explains WHY asking questions
- ✅ Handles off-topic gracefully
- ✅ Each product has detailed reason (>50 chars)
- ✅ Cites concrete facts (price, miles, reviews)
- ✅ Invites follow-up
- ✅ Conversation length ≤ 4 turns

**Off-Topic Test:**
- User asks: "How's the weather where you are?"
- AI: Acknowledges warmly (1 sentence) + returns to goal (1 sentence)
- Guidance score ≥ 4.0

#### **CONV-SNOW-01: Beginner Snowboard** (`tests/conversations/CONV-SNOW-01.beginner-board.test.ts`)

**Scenario:** Clear intent upfront ("beginner snowboard under $400")

**Expected Flow:**
1. User: "beginner snowboard under $400"
2. AI: Shows 2-3 boards immediately OR asks 1 quick clarifier
3. (If clarifier) User: "all-mountain"
4. AI: Shows 2-3 boards with tradeoffs

**Assertions:**
- ✅ Fast path (1-2 turns to recommendations)
- ✅ Explains tradeoffs between options
- ✅ References user's budget and experience
- ✅ Naturalness ≥ 4.0
- ✅ Recommendations ≥ 4.0
- ✅ Comparison words present ("but", "however", "while")
- ✅ Specific tradeoffs in reasons

---

### 5. **Quality Gates**

Minimum thresholds that must be met for tests to pass.

| Metric | Threshold | Description |
|--------|-----------|-------------|
| **Naturalness Score** | ≥ 4.0 / 5.0 | Warmth, contractions, varied sentences, no boilerplate |
| **Recommendation Score** | ≥ 4.0 / 5.0 | 2-3 products, detailed reasons, tradeoffs, specific features |
| **Clarification Score** | ≥ 4.0 / 5.0 | 1-2 questions, explains WHY, natural phrasing, progressive |
| **Guidance Score** | ≥ 4.0 / 5.0 | Handles off-topic warmly, returns to goal in ≤2 sentences |
| **Clarifier Efficiency** | ≤ 2.0 avg/turn | Not too many questions per turn |
| **Shortlist Size** | 2-3 products | Not too many choices (choice overload) |
| **Conversation Length** | ≤ 6 turns | Efficient path to recommendation |
| **Persona Violations** | 0 | No robotic boilerplate detected |
| **Test Pass Rate** | ≥ 90% | 90% of tests must pass |

**Quality Gate Checker:**
- Script: `tests/check-quality-gates.ts`
- Command: `npm run check:quality-gates`
- Exit code: 0 if all gates pass, 1 if any fail

---

### 6. **CI/CD Integration**

#### **GitHub Actions Workflow** (`.github/workflows/conversation-quality.yml`)

**Triggers:**
- Every push to `main` or `develop`
- Every pull request to `main` or `develop`

**Steps:**
1. Checkout code
2. Setup Node.js 18
3. Install dependencies
4. Run conversation quality tests
5. Upload test results as artifacts
6. Comment PR with results (if PR)
7. Check quality gates
8. Fail build if gates don't pass

**Environment Variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `CLIENT_API_KEYS`

**Artifacts:**
- Test results saved for 30 days
- Summary JSON with scores
- Detailed logs

**PR Comments:**
Automatically posts quality scores to PR:

```
## 🤖 Conversation Quality Test Results

| Metric | Score | Status |
|--------|-------|--------|
| Naturalness | 4.5/5.0 | ✅ |
| Recommendations | 4.8/5.0 | ✅ |
| Clarification | 4.2/5.0 | ✅ |
| Overall | 4.5/5.0 | ✅ |

**Tests:** 10/10 passed
**Duration:** 45.2s
```

---

## Running Tests

### All Conversation Tests
```bash
npm run test:conversations
```

### Specific Test
```bash
npm test -- tests/conversations/CONV-RUN-01
```

### With Verbose Output
```bash
npm test -- tests/conversations --verbose
```

### Check Quality Gates
```bash
npm run check:quality-gates
```

---

## File Structure

```
backend/
├── tests/
│   ├── conversations/
│   │   ├── CONV-RUN-01.marathon-training.test.ts
│   │   ├── CONV-SNOW-01.beginner-board.test.ts
│   │   └── README.md
│   ├── utils/
│   │   ├── convoHarness.ts          # Conversation test harness
│   │   ├── personaLinter.ts         # Human-ness linter
│   │   └── judges.ts                # LLM-as-Judge scoring
│   ├── check-quality-gates.ts       # Quality gate checker
│   └── setup.ts                     # Test environment setup
├── jest.conversations.config.js     # Jest config for conversation tests
└── package.json                     # Added test:conversations script
```

---

## Test Output Example

```
🧪 Testing Natural Chat Endpoint
================================================================================

📝 Turn 1: "I need running shoes"
--------------------------------------------------------------------------------
   Naturalness: 4.5/5
     - Uses natural contractions ("I'll", "you're")
     - Warm and conversational tone
     - Explains reasoning clearly
   
   Clarification: 4.8/5
     - Asks 1-2 thoughtful questions
     - Explains WHY asking
     - Natural phrasing

📝 Turn 2: "Training for my first marathon"
--------------------------------------------------------------------------------
   Naturalness: 4.7/5
     - Builds on previous answer naturally
     - Varied sentence structure
     - Genuine enthusiasm

📝 Turn 3: "Road, first marathon, about 30 miles per week"
--------------------------------------------------------------------------------
   Recommendations: 5.0/5
     - Shows exactly 2 products
     - Detailed, personal reasons
     - Cites specific features (price, weight, reviews)
     - Clear tradeoffs explained

📊 Conversation Summary:
   - Total turns: 3
   - Total clarifiers: 3
   - Products shown: 2
   - Final pick: Brooks Ghost 15

✅ All quality gates passed!
```

---

## Key Achievements

### ✅ Phase 2 Complete

1. **Conversation Test Harness** - Multi-turn simulation with structured parsing
2. **Human-ness Linter** - Fast deterministic checks (contractions, variety, no boilerplate)
3. **LLM-as-Judge** - 4 judges scoring warmth, recommendations, clarification, guidance
4. **Golden Conversations** - 2 complete test scenarios (marathon, snowboard)
5. **Quality Gates** - 9 metrics with thresholds
6. **CI/CD Integration** - GitHub Actions workflow with PR comments
7. **Documentation** - Complete README and usage examples

---

## Next Steps

### Phase 3: Deployment & Validation (Week 3-4)

1. **Database Seeding**
   - Create test shops with Store Cards
   - Import product catalogs
   - Generate realistic data

2. **End-to-End Testing**
   - Run golden conversations with real data
   - Validate all quality gates pass
   - Tune system prompt if needed

3. **A/B Testing**
   - Deploy natural pipeline to 10% of traffic
   - Track conversion, satisfaction, engagement
   - Compare with current pipeline

4. **Monitoring Dashboard**
   - Real-time quality scores
   - Conversation length distribution
   - Product recommendation accuracy
   - User satisfaction metrics

5. **Production Rollout**
   - Gradual traffic increase (10% → 25% → 50% → 100%)
   - Quality monitoring at each stage
   - Performance optimization
   - Full migration

---

## Comparison: Before vs After

### Before (Phase 1)
- ✅ Natural system prompt
- ✅ Simplified pipeline
- ✅ Parallel API endpoint
- ❌ No quality validation
- ❌ No automated testing
- ❌ No CI/CD integration

### After (Phase 2)
- ✅ Natural system prompt
- ✅ Simplified pipeline
- ✅ Parallel API endpoint
- ✅ **Conversation test harness**
- ✅ **Human-ness linter**
- ✅ **LLM-as-Judge scoring**
- ✅ **Golden conversation tests**
- ✅ **Quality gates**
- ✅ **CI/CD integration**

---

## Success Metrics

### Test Coverage
- ✅ 2 golden conversation scenarios
- ✅ 4 LLM judges implemented
- ✅ 8+ persona checks
- ✅ 9 quality gates defined

### Quality Thresholds
- ✅ Naturalness ≥ 4.0 / 5.0
- ✅ Recommendations ≥ 4.0 / 5.0
- ✅ Clarification ≥ 4.0 / 5.0
- ✅ Guidance ≥ 4.0 / 5.0
- ✅ Test pass rate ≥ 90%

### Infrastructure
- ✅ Automated CI/CD pipeline
- ✅ PR quality comments
- ✅ Test result artifacts
- ✅ Quality gate enforcement

---

## The Complete Vision

### Phase 1: System Redesign ✅
> "Build a natural system that CAN produce human-like conversations"

- Natural system prompt
- Simplified pipeline
- Trust Gemini's intelligence

### Phase 2: Testing Infrastructure ✅
> "Prove the system DOES produce human-like conversations"

- Human-ness linter
- LLM-as-Judge scoring
- Golden conversation tests
- Quality gates

### Phase 3: Deployment 🔄
> "Ensure the system CONTINUES to produce human-like conversations"

- A/B testing
- Real-time monitoring
- Quality dashboards
- Production rollout

---

## Conclusion

**Phase 2 is complete.** We've built a comprehensive testing infrastructure that:

✅ **Validates conversation quality** with human-ness linting and LLM-as-Judge  
✅ **Catches regressions** with automated quality gates  
✅ **Integrates with CI/CD** for every commit and PR  
✅ **Provides clear feedback** with detailed scores and reasons  
✅ **Scales to new scenarios** with reusable test utilities  

**Next:** Seed database and run end-to-end validation with real data.

---

**Implementation Date:** October 29, 2025  
**Status:** Phase 2 Complete ✅  
**Ready for:** Database seeding and end-to-end testing  
**GitHub:** https://github.com/ojieame12/concierge-clean
