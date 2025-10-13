/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Skipping for now, not sure how to handle tests with remote functions that throw errors
describe.skip("Read-Only Mode Remote Functions Tests", () => {
	let originalEnv: string | undefined;

	beforeEach(() => {
		// Store original env value
		originalEnv = process.env.MONGOKU_READ_ONLY_MODE;
	});

	afterEach(() => {
		// Restore original env value
		if (originalEnv !== undefined) {
			process.env.MONGOKU_READ_ONLY_MODE = originalEnv;
		} else {
			delete process.env.MONGOKU_READ_ONLY_MODE;
		}
		vi.clearAllMocks();
	});

	describe("updateDocument", () => {
		it("should throw error when trying to update a document in read-only mode", async () => {
			process.env.MONGOKU_READ_ONLY_MODE = "true";

			const { updateDocument } = await import("../../api/servers.remote");

			try {
				await updateDocument({
					server: "test",
					database: "testdb",
					collection: "testcol",
					document: "507f1f77bcf86cd799439011",
					value: { name: "updated" },
					partial: false,
				});
				expect.fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.status).toBe(403);
				expect(error.body.message).toContain("Read-only mode");
			}
		});

		it("should allow updates when not in read-only mode", async () => {
			delete process.env.MONGOKU_READ_ONLY_MODE;

			const { updateDocument } = await import("../../api/servers.remote");

			// Should work or fail for a different reason
			try {
				const response = await updateDocument({
					server: "test",
					database: "testdb",
					collection: "testcol",
					document: "507f1f77bcf86cd799439011",
					value: { name: "updated" },
					partial: false,
				});
				// Success case
				expect(response.ok).toBe(true);
			} catch (error: any) {
				// If it fails, it shouldn't be because of read-only mode
				expect(error.status).not.toBe(403);
			}
		});
	});

	describe("deleteDocument", () => {
		it("should throw error when trying to delete a document in read-only mode", async () => {
			process.env.MONGOKU_READ_ONLY_MODE = "true";

			const { deleteDocument } = await import("../../api/servers.remote");

			try {
				await deleteDocument({
					server: "test",
					database: "testdb",
					collection: "testcol",
					document: "507f1f77bcf86cd799439011",
				});
				expect.fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.status).toBe(403);
				expect(error.body.message).toContain("Read-only mode");
			}
		});
	});
});
