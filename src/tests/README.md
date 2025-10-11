# Mongoku Tests

This directory contains the test suite for Mongoku, built with Vitest.

## Structure

```
src/tests/
├── setup.ts           # Test setup and mocks
├── api/
│   └── readonly.test.ts  # Read-only mode API tests
└── README.md          # This file
```

## Running Tests

```bash
# Run all tests once
pnpm test

# Run tests in watch mode (re-runs on file changes)
pnpm test:watch

# Run tests with UI
pnpm test:ui
```

## Test Coverage

### Read-Only Mode Tests (`api/readonly.test.ts`)

These tests verify that the read-only mode properly blocks write operations:

#### Write Operations (Should Return 403)

- ✅ `PUT /api/servers` - Adding a new server
- ✅ `DELETE /api/servers/:server` - Removing a server
- ✅ `POST /api/servers/.../documents/:document` - Updating a document
- ✅ `DELETE /api/servers/.../documents/:document` - Deleting a document

#### Read Operations (Should Work Normally)

- ✅ Read operations work normally (read-only status is provided by `+layout.server.ts`)

#### Non-Read-Only Mode

- ✅ All operations work normally when `MONGOKU_READ_ONLY_MODE` is not set

## Writing New Tests

### Example Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Feature Name", () => {
	beforeEach(() => {
		// Setup before each test
	});

	afterEach(() => {
		// Cleanup after each test
	});

	it("should do something", async () => {
		// Arrange
		const input = "test";

		// Act
		const result = await someFunction(input);

		// Assert
		expect(result).toBe("expected");
	});
});
```

### Testing API Routes

When testing SvelteKit API routes, remember that the `error()` function throws:

```typescript
it("should throw 403 error", async () => {
	try {
		await someEndpoint();
		expect.fail("Should have thrown an error");
	} catch (error: any) {
		expect(error.status).toBe(403);
		expect(error.body.message).toContain("expected message");
	}
});
```

## Mocking

The test setup (`setup.ts`) mocks the MongoDB module to avoid real database connections:

- `getMongo()` returns a mock with stubbed methods
- Customize mocks per test using `vi.mock()` in your test file
- Clear mocks between tests with `vi.clearAllMocks()`

## CI/CD Integration

To run tests in CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run tests
  run: pnpm test
```

Tests must pass before merging pull requests.
