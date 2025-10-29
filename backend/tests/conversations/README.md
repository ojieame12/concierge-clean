# Conversation Quality Tests

End-to-end tests for validating natural conversation quality using human-ness linting and LLM-as-Judge scoring.

## Quick Start

```bash
# Run all conversation tests
npm run test:conversations

# Run specific test
npm test -- tests/conversations/CONV-RUN-01
```

## Test Structure

Each test validates a complete multi-turn conversation:

```typescript
describe('CONV-XXX: Scenario', () => {
  it('validates conversation flow', async () => {
    const session = await startSession({ persona: 'friendly_expert' });
    
    // Turn 1
    const response = await send(session, 'I need running shoes');
    assertPersonaChecks(response.text); // Human-ness linter
    
    const naturalness = await judgeNaturalness(response.text); // LLM judge
    expect(naturalness.score).toBeGreaterThanOrEqual(4);
  });
});
```

## Quality Gates

| Metric | Threshold |
|--------|-----------|
| Naturalness | ≥ 4.0 / 5.0 |
| Recommendations | ≥ 4.0 / 5.0 |
| Clarification | ≥ 4.0 / 5.0 |
| Shortlist Size | 2-3 products |
| Conversation Length | ≤ 6 turns |

## Test Utilities

- **convoHarness.ts** - Multi-turn conversation simulation
- **personaLinter.ts** - Fast deterministic checks (contractions, variety)
- **judges.ts** - LLM-as-Judge scoring (warmth, naturalness, guidance)

See [tests/README.md](../README.md) for full documentation.
