# Setting Up and Running Connection Validator Tests

## Quick Start

```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Run tests
npm test

# 3. Run tests with coverage
npm run test:coverage
```

## Detailed Setup

### Step 1: Install Jest and Dependencies

If you haven't installed the dependencies yet:

```bash
npm install
```

This will install:
- `jest` - Testing framework
- `ts-jest` - TypeScript support for Jest
- `@types/jest` - TypeScript types for Jest
- `ts-node` - TypeScript execution engine

### Step 2: Verify Jest Configuration

The following files should exist:

1. **jest.config.ts** - Main Jest configuration
2. **src/test/setup.ts** - Test setup and console mocks
3. **src/store/connection-validator.test.ts** - Test suite

### Step 3: Run the Tests

#### Option A: Using npm scripts (Recommended)

```bash
# Run all tests
npm test

# Run in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage
```

#### Option B: Using PowerShell script (Windows)

```powershell
.\run-tests.ps1
```

#### Option C: Using Command script (Windows)

```cmd
run-tests.cmd
```

#### Option D: Direct Jest command

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js
```

### Step 4: Verify Success

You should see output similar to:

```
PASS  src/store/connection-validator.test.ts
  Connection Validator
    isValidConnection (Cache Builder)
      ✓ should return null for empty source node ID
      ✓ should return null for empty nodes array
      ...
    Complex Scenarios
      ✓ should handle multi-step validation chains
      ✓ should prevent feedback loops
      ✓ should validate mask workflow correctly

Test Suites: 1 passed, 1 total
Tests:       51 passed, 51 total
Snapshots:   0 total
Time:        2.345 s
```

## Troubleshooting

### Error: "Cannot find module '@jest/globals'"

**Solution**: Ensure dependencies are installed and `tsconfig.json` includes the test files.

```bash
npm install
```

### Error: "ExperimentalWarning: VM Modules"

**This is normal**: The `--experimental-vm-modules` flag is required for ES module support in Jest. This warning can be safely ignored.

### Error: "TypeError: Cannot read property 'fn' of undefined"

**Solution**: Make sure `jest.mock()` is called properly. Check that the mock path is correct:

```typescript
jest.mock('../services/performance', () => ({
  perfMonitor: {
    start: jest.fn(),
    end: jest.fn(),
    getMetrics: jest.fn(() => ({ duration: 0.5 }))
  }
}));
```

### Error: "Tests are taking too long"

**Solution**: This might be the performance test checking 100+ nodes. This is expected behavior. If you want to skip performance tests temporarily:

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js --testNamePattern="^(?!.*Performance)"
```

### Error: "Coverage threshold not met"

**Solution**: 

1. View the coverage report: `coverage/lcov-report/index.html`
2. Identify uncovered lines
3. Add tests for those scenarios

Or temporarily lower the threshold in `jest.config.ts`:

```typescript
coverageThreshold: {
  global: {
    branches: 70, // Lower from 80
    functions: 70,
    lines: 70,
    statements: 70
  }
}
```

### Error: "Cannot find module '../types/connection.types'"

**Solution**: Ensure the path is correct and the file exists:

```bash
ls src/types/connection.types.ts
```

If the path is different, update the import in the test file.

## Expected Test Performance

- **Execution time**: < 5 seconds
- **Cache validation**: < 0.01ms per lookup
- **Large dataset**: < 50ms for 100+ nodes
- **Cache hit rate**: 80%+

## Coverage Report

After running `npm run test:coverage`, open `coverage/lcov-report/index.html` in your browser to view detailed coverage information.

## CI/CD Integration

### GitHub Actions

Add to your `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests
        run: npm test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/sh
npm test
```

## Manual Test Execution

If you want to test manually in the browser:

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open browser console:
   ```javascript
   // Enable debug logging
   localStorage.setItem('debug_connection', 'true');
   
   // Try connecting nodes
   // Blocked connections will appear in console
   ```

## Next Steps

1. ✅ Tests created
2. ✅ Jest configured
3. ✅ Run tests with `npm test`
4. ✅ Review coverage with `npm run test:coverage`
5. ✅ Integrate into CI/CD pipeline
6. ✅ Add more tests as needed for new node types

## Support

If tests fail after setup:

1. Clear Jest cache: `npx jest --clearCache`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check Node version: `node --version` (requires v16+)
4. Check TypeScript: `npx tsc --noEmit`

For more help, see the [Jest documentation](https://jestjs.io/) and [ts-jest documentation](https://kulshekhar.github.io/ts-jest/).