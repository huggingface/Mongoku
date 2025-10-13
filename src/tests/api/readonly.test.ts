/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Read-Only Mode Remote Functions Tests", () => {
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

	describe("addServer", () => {
		it("should throw error when in read-only mode", async () => {
			process.env.MONGOKU_READ_ONLY_MODE = "true";

			// Dynamically import to ensure env is set before module loads
			const { addServer } = await import("../../api/servers.remote");

			// Remote functions throw errors, so we need to catch them
			try {
				await addServer({ url: "mongodb://localhost:27017" });
				expect.fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.status).toBe(403);
				expect(error.body.message).toContain("Read-only mode");
			}
		});

		it("should work normally when not in read-only mode", async () => {
			delete process.env.MONGOKU_READ_ONLY_MODE;

			const { addServer } = await import("../../api/servers.remote");

			// Should either succeed or fail for a different reason (not 403)
			try {
				const response = await addServer({ url: "mongodb://localhost:27017" });
				// Success case
				expect(response.ok).toBe(true);
			} catch (error: any) {
				// If it fails, it shouldn't be because of read-only mode
				expect(error.status).not.toBe(403);
			}
		});
	});

	describe("removeServer", () => {
		it("should throw error when in read-only mode", async () => {
			process.env.MONGOKU_READ_ONLY_MODE = "true";

			const { removeServer } = await import("../../api/servers.remote");

			try {
				await removeServer("test");
				expect.fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.status).toBe(403);
				expect(error.body.message).toContain("Read-only mode");
			}
		});
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
