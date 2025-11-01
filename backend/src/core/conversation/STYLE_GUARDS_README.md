# Deterministic Style Guards

## Overview

The Style Guards system is a post-processing layer that enforces stylistic and structural rules on LLM-generated responses. It operates on the principle of **separating reasoning ("brain") from style ("voice")**, allowing the primary LLM to focus on content quality while deterministic code ensures consistent tone, length, and structure.

## Architecture

```
User Input → Gemini (Brain) → JSON Output → Style Guards → Final Response
                                              ↑
                                         Session Memory
```

The guards run **after** the LLM generates its response but **before** it's sent to the user. This ensures:
- **Zero risk to facts**: Guards only modify form (style, length, structure), never content
- **Deterministic enforcement**: Rules are guaranteed to be applied, not probabilistic
- **Stateful memory**: Tracks conversation history to prevent repetition

## The Five Guards

### 1. Length Governor
**Purpose**: Enforce maximum sentence counts for messages.

**How it works**:
- Splits text into sentences using a robust tokenizer
- Scores sentences by semantic importance (preserves product names, prices, recommendations)
- Keeps the top N most important sentences

**Configuration**:
- `maxSentences`: Maximum sentences in message (typically 1-2)

**Example**:
```typescript
// Before: "Here are three great boards. The Burton Custom is perfect for you. It's $500. We also have the Capita DOA."
// After (max 2): "The Burton Custom is perfect for you. It's $500."
```

### 2. Opener Diversity
**Purpose**: Prevent repeated opening sentences across turns.

**How it works**:
- Tracks the last 10 opening sentences in session memory
- Detects exact or near-exact matches (first 30 characters)
- Replaces repeated openers with a fresh one from a bank of 50+ variants

**Opener Bank**:
- Question acknowledgment: "Fair question.", "Good question.", etc.
- Agreement: "Makes sense.", "Good call.", etc.
- Transition: "Got you.", "Let's do it.", etc.
- Information: "Here's the gist.", "Quick rundown:", etc.

**Example**:
```typescript
// Turn 1: "Fair question. Here are some options."
// Turn 2 (before guard): "Fair question. Let me explain."
// Turn 2 (after guard): "Good call. Let me explain."
```

### 3. Contraction Normalizer
**Purpose**: Inject contractions for natural, conversational tone.

**How it works**:
- Applies 30+ regex patterns to replace formal phrases with contractions
- Examples: "I am" → "I'm", "you are" → "you're", "do not" → "don't"

**Example**:
```typescript
// Before: "I am happy to help. You are looking for a board."
// After: "I'm happy to help. You're looking for a board."
```

### 4. Clarifier Memory
**Purpose**: Prevent asking the same clarifying question twice.

**How it works**:
- Tracks answered clarifier facets in session memory
- Filters out clarifiers for facets already answered
- Implements TTL (Time-To-Live) of 10 turns to allow re-asking if context changes

**Example**:
```typescript
// Turn 1: "What terrain do you prefer?" → User answers "powder"
// Turn 5 (before guard): "What terrain do you prefer?" (repeated!)
// Turn 5 (after guard): null (clarifier removed)
```

### 5. Reason Enricher
**Purpose**: Augment product recommendations with concrete reasons.

**How it works**:
- Checks if LLM-generated reasons are sparse (< 2 reasons)
- Adds generic helpful reason if needed

**Example**:
```typescript
// Before: { id: "board-1", why: [] }
// After: { id: "board-1", why: ["Matches your preferences"] }
```

## Integration

### In `orchestrator.ts`

The guards are integrated into the `runTurn` function:

```typescript
const output = OutputSchema.parse(json);

// Apply style guards
const isGreeting = session.messages.length <= 1;
const maxSentences = decideSentenceCaps(output.mode, isGreeting);

const guarded = applyStyleGuards(output, {
  maxSentences,
  openerHistory: session.openerHistory || [],
  answeredClarifiers: new Set(session.answeredClarifierFacets || []),
});

output = guarded.data;

// Add telemetry
output.meta = {
  ...output.meta,
  guard_telemetry: guarded.telemetry,
};
```

### Session Memory Updates

After each turn, update session memory:

```typescript
import { updateGuardMemory } from '../session/guard-memory';

const memoryPatch = updateGuardMemory(sessionMetadata, {
  newOpener: output.message,
  answeredClarifierFacet: userAnsweredFacet,
});

// Merge memoryPatch into sessionMetadata
```

## Configuration

Guards can be selectively enabled/disabled:

```typescript
applyStyleGuards(response, {
  maxSentences: 2,
  openerHistory: [],
  answeredClarifiers: new Set(),
  enabledGuards: {
    lengthGovernor: true,
    openerDiversity: true,
    contractionNormalizer: true,
    clarifierMemory: true,
    reasonEnricher: false, // Disable if not needed
  },
});
```

## Telemetry

Every guard execution produces telemetry:

```typescript
{
  guardsApplied: ['lengthGovernor', 'openerDiversity', 'contractionNormalizer'],
  modifications: [
    {
      guard: 'lengthGovernor',
      field: 'message',
      before: 'Long text...',
      after: 'Trimmed text...',
      reason: 'Trimmed from 5 to 2 sentences'
    }
  ],
  errors: [],
  executionTimeMs: 8
}
```

Use the logging utility to track guard effectiveness:

```typescript
import { logGuardTelemetry } from '../logging/guard-telemetry';

logGuardTelemetry({
  timestamp: new Date().toISOString(),
  shopId,
  sessionId,
  turnId,
  telemetry: guarded.telemetry,
});
```

## Testing

Comprehensive unit tests are in `__tests__/style-guards.test.ts`:

```bash
npm test -- style-guards.test.ts
```

Tests cover:
- Each guard individually
- Guard combinations
- Edge cases (empty text, exhausted openers, etc.)
- Telemetry accuracy
- Error handling

## Performance

Guards add minimal latency:
- **Total overhead**: ~10ms per turn
- **Length Governor**: <1ms
- **Opener Diversity**: <1ms
- **Contraction Normalizer**: ~2ms
- **Clarifier Memory**: <1ms
- **Reason Enricher**: ~5ms

This is negligible compared to LLM API latency (~500-2000ms).

## Rollout Plan

### Phase 1: Shadow Mode (Week 1)
- Deploy guards behind feature flag
- Run in "shadow mode" (log what would change, don't modify output)
- Monitor telemetry to understand impact

### Phase 2: A/B Test (Week 2-3)
- Enable for 10% of traffic
- Compare metrics:
  - Test pass rate (should improve)
  - User satisfaction (CSAT scores)
  - Response coherence (manual review sample)

### Phase 3: Full Rollout (Week 4)
- Gradually increase to 100% of traffic
- Monitor for edge cases and refine as needed

## Future Enhancements

### 1. Voice Model (3-6 months)
Replace hardcoded guards with a small, fine-tuned 7B model (Llama 3.1, Qwen 2.5) that can:
- Rewrite entire responses for better naturalness
- Handle complex style transformations
- Learn from production data

### 2. Domain-Specific Reason Enricher
Add product-specific heuristics based on actual product data

### 3. Adaptive Caps
Dynamically adjust sentence caps based on:
- User persona (minimalist vs. explorer)
- Conversation stage (early discovery vs. final recommendation)
- Product complexity (simple vs. technical)

## Troubleshooting

### Guard not firing
- Check `enabledGuards` configuration
- Verify session memory is being passed to `runTurn`
- Review telemetry logs for errors

### Over-aggressive trimming
- Increase `maxSentences`
- Review semantic importance scoring in Length Governor

### Incoherent opener replacements
- Expand opener bank with more contextually appropriate variants

### Clarifiers being incorrectly filtered
- Check TTL settings (default 10 turns)
- Verify `answeredClarifierFacets` is being updated correctly

## References

- [Codebase Analysis](/home/ubuntu/concierge_clean_analysis.md)
- [Test Suite](./__tests__/style-guards.test.ts)
