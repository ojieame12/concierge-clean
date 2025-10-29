# Insite B2B Test Suite

Comprehensive testing framework for the Insite conversational commerce platform.

## Structure

```
tests/
├── fixtures/          # Test data (Store Cards, products)
├── golden/            # Golden test scenarios (end-to-end)
├── unit/              # Unit tests (individual functions)
├── setup.ts           # Test configuration
└── run-tests.ts       # Test runner
```

## Running Tests

### All Tests
```bash
npm test
```

### Golden Tests Only
```bash
npm run test:golden
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Golden Test Scenarios

### Scenario 1: Beginner Snowboard
**Query:** "I need a beginner snowboard under $400"

**Tests:**
- Constraint satisfaction (skill_level, price)
- Brand prioritization (Burton)
- Response structure validation
- Price fallback handling

**Expected:**
- 2-3 beginner boards under $400
- Burton boards prioritized
- No advanced/expert boards
- Valid response structure

---

### Scenario 2: Price Comparison
**Query:** "Show me running shoes around $150"

**Tests:**
- Price fit scoring (min-only, max-only, range)
- Midpoint preference
- Out-of-range filtering

**Expected:**
- Shoes within $120-$180 range
- Closest to $150 ranked higher
- Proper handling of "at least" and "under" constraints

---

### Scenario 3: Store Intelligence
**Query:** "What's your return policy?"

**Tests:**
- Store Card formatting
- Policy accuracy (returns, shipping, warranty)
- Merchandising priorities
- FAQ inclusion

**Expected:**
- Accurate policy information
- Brand voice consistency
- Complete Store Card data

## Test Metrics

### Coverage Goals
- **Lines:** ≥80%
- **Functions:** ≥75%
- **Branches:** ≥70%

### Performance Goals
- **Unit tests:** <100ms each
- **Golden tests:** <5s each (with LLM)
- **Full suite:** <30s

### Quality Gates
- **Schema pass rate:** 100%
- **Constraint satisfaction:** ≥85%
- **Clarifier efficiency:** ≤2.2 avg questions
- **Groundedness:** ≥95%
- **Store intelligence accuracy:** ≥98%

## Writing Tests

### Golden Test Template
```typescript
import { describe, it, expect } from '@jest/globals';
import { mockProducts } from '../fixtures/products.fixture';

describe('Golden Test: Your Scenario', () => {
  it('should do something', () => {
    // Arrange
    const query = 'user query';
    
    // Act
    const result = yourFunction(query);
    
    // Assert
    expect(result).toBeDefined();
  });
});
```

### Fixtures
Use fixtures for consistent test data:
- `mockStoreCard` - Full Store Card
- `mockProducts` - Snowboard products
- `mockRunningShoes` - Running shoe products

## Environment Variables

Tests use `.env` by default. To skip certain tests:

```bash
# Skip LLM tests (faster)
SKIP_LLM_TESTS=true npm test

# Skip database tests
SKIP_DB_TESTS=true npm test
```

## Continuous Integration

Tests run automatically on:
- Every commit (pre-commit hook)
- Every pull request (GitHub Actions)
- Before deployment (Railway/Render)

## Debugging Tests

### Run single test file
```bash
npx jest tests/golden/scenario-1-beginner-snowboard.test.ts
```

### Run single test
```bash
npx jest -t "should return beginner boards"
```

### Verbose output
```bash
npm test -- --verbose
```

### Debug mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Test Data

### Products
- 5 snowboards (beginner to expert, $199-$699)
- 3 running shoes (Nike, Adidas, Brooks, $129-$189)
- Products with missing price (for fallback testing)

### Store Cards
- Full Store Card (outdoor gear store)
- Minimal Store Card (basic configuration)

## Contributing

1. Write tests for new features
2. Ensure all tests pass before committing
3. Maintain ≥80% code coverage
4. Follow existing test patterns
5. Update fixtures as needed

## Troubleshooting

### Tests timing out
- Increase timeout in `jest.config.js`
- Skip LLM tests with `SKIP_LLM_TESTS=true`

### Module not found
- Check `moduleNameMapper` in `jest.config.js`
- Ensure imports use `@/` prefix

### Type errors
- Run `npm install` to update dependencies
- Check TypeScript version compatibility

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)
- [Insite Architecture](../../README.md)
