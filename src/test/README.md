# Connection Validator Tests

## Overview

Comprehensive unit tests for the connection validation logic in `src/store/connection-validator.ts`.

## Test Coverage

### 1. **isValidConnection (Cache Builder)** - 9 tests
- ✅ Returns null for empty source node ID
- ✅ Returns null for empty nodes array
- ✅ Returns null for non-existent source node
- ✅ Builds validation cache for valid source node
- ✅ Uses default handle when sourceHandleId is null
- ✅ Marks self-connections as invalid

### 2. **isValidConnection (Connection Validation)** - 11 tests
- ✅ Allows valid connections between compatible types (prompt → imagen)
- ✅ Blocks imageUpload to seed connection
- ✅ Blocks videoUpload to seed connection
- ✅ Blocks self-connections
- ✅ Returns error for missing source/target nodes
- ✅ Allows image to resize connection
- ✅ Allows image to blur connection
- ✅ Allows number to seed connection
- ✅ Blocks incompatible type connections

### 3. **isValidConnectionCached** - 5 tests
- ✅ Returns cached validation result for valid connection
- ✅ Returns cached validation result for invalid connection
- ✅ Returns error when cache is null
- ✅ Returns error when target is not in cache
- ✅ Returns error when target is not specified

### 4. **getConnectionFeedback** - 5 tests
- ✅ Returns valid feedback for source node with valid targets
- ✅ Returns invalid feedback when source is missing
- ✅ Returns invalid feedback for non-existent source node
- ✅ Builds cache fallback when not provided
- ✅ Filters out self-connections from valid targets

### 5. **validateMultipleConnections** - 2 tests
- ✅ Validates multiple connections and returns results with connections
- ✅ Handles empty connections array

### 6. **CONNECTION_VALIDATION_RULES** - 3 tests
- ✅ Has valid configuration for seed node
- ✅ Has valid configuration for all node types
- ✅ Has valid blocked connections with reasons

### 7. **NODE_HANDLES** - 2 tests
- ✅ Has valid handle definitions for all node types
- ✅ Has valid handle definitions with required properties

### 8. **Edge Cases** - 5 tests
- ✅ Handles nodes with empty handle arrays
- ✅ Handles invalid handle IDs
- ✅ Handles missing nodes gracefully
- ✅ Handles undefined handles gracefully
- ✅ Handles nodes with unknown types

### 9. **Performance** - 5 tests
- ✅ Validates connections in under 1ms for small datasets
- ✅ Builds cache efficiently for all nodes
- ✅ Maintains O(1) lookup performance with cache
- ✅ Handles large datasets efficiently (100+ nodes)
- ✅ Demonstrates good cache hit rates (80%+)

### 10. **Complex Scenarios** - 3 tests
- ✅ Handles multi-step validation chains (prompt → imagen → resize → blur)
- ✅ Prevents feedback loops (imagen → seed blocked)
- ✅ Validates mask workflow correctly (image → maskExtractor → matteAdjust)

**Total: 51 comprehensive test cases**

## Running Tests

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test connection-validator.test.ts

# Watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Expected Output

```
PASS  src/store/connection-validator.test.ts
  Connection Validator
    isValidConnection (Cache Builder)
      ✓ should return null for empty source node ID (3 ms)
      ✓ should return null for empty nodes array (1 ms)
      ...

Test Suites: 1 passed, 1 total
Tests:       51 passed, 51 total
Snapshots:   0 total
Time:        ~2-3 seconds
```

## Coverage Requirements

- ✅ **80%+ code coverage** enforced
- ✅ All tests must pass
- ✅ No skipped tests
- ✅ Fast execution (< 5 seconds)

## Mock Data

The test suite includes comprehensive mock data:

### Node Types Tested
- `prompt` - Text prompt nodes
- `imagen` - Image generation
- `imageUpload` - Image upload
- `seed` - Random seed (with blocked connections)
- `resize`, `blur` - Image processing
- `maskExtractor` - Mask extraction
- `number` - Numeric values
- `videoUpload` - Video upload
- `toggle` - Boolean toggles

### Connection Scenarios
- Valid: prompt → imagen, image → resize, number → seed
- Invalid: image → seed, video → seed, imagen → seed (feedback loop)
- Type mismatches: toggle → imagen
- Missing nodes: non-existent → valid
- Self-connections: prompt → prompt

## Test Framework

- **Jest** - Test runner and assertion library
- **ts-jest** - TypeScript support for Jest
- **@types/jest** - TypeScript types for Jest

## Continuous Integration

Add to your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run Tests
  run: npm test

- name: Check Coverage
  run: npm run test:coverage
```

## Troubleshooting

### Tests won't run

```bash
# Ensure dependencies are installed
npm install

# Clear Jest cache
npx jest --clearCache
```

### Type errors

```bash
# Run TypeScript compiler to check for type errors
npm run lint
```

### Coverage not meeting threshold

```bash
# Generate and view coverage report
npm run test:coverage
open coverage/lcov-report/index.html
```

## Adding New Tests

When adding new node types or validation rules:

1. Add mock node to `mockNodes` array
2. Add connection test cases in appropriate describe block
3. Update validation rules tests if needed
4. Run tests to ensure coverage remains above 80%

Example:

```typescript
it('should allow newNodeType to connect to destination', () => {
  const result = isValidConnection({
    source: 'new-node',
    target: 'destination-node',
    sourceHandle: 'output',
    targetHandle: 'input'
  }, mockNodes);
  
  expect(result.valid).toBe(true);
});
```

## Architecture Notes

The test suite validates:

1. **Allow-list validation strategy** - Only explicitly permitted connections work
2. **Semantic handle typing** - Handles declare their data type (image, prompt, video, etc.)
3. **O(1) cache performance** - Validation cache enables real-time feedback during drag
4. **Comprehensive error messages** - Blocked connections include clear reasons
5. **Edge case handling** - Empty handles, missing nodes, type mismatches

## Files Tested

- `src/store/connection-validator.ts` - Main validation logic
- `src/types/connection.types.ts` - Validation rules and handle definitions
