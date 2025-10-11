/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Read-Only Mode API Tests", () => {
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

	describe("PUT /api/servers", () => {
		it("should return 403 when in read-only mode", async () => {
			process.env.MONGOKU_READ_ONLY_MODE = "true";

			// Dynamically import to ensure env is set before module loads
			const { PUT } = await import("../../routes/api/servers/+server");

			const request = new Request("http://localhost/api/servers", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: "mongodb://localhost:27017" }),
			});

			// SvelteKit's error() function throws, so we need to catch it
			try {
				await PUT({ request, params: {} } as any);
				expect.fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.status).toBe(403);
				expect(error.body.message).toContain("Read-only mode");
			}
		});

		it("should work normally when not in read-only mode", async () => {
			delete process.env.MONGOKU_READ_ONLY_MODE;

			const { PUT } = await import("../../routes/api/servers/+server");

			const request = new Request("http://localhost/api/servers", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: "mongodb://localhost:27017" }),
			});

			// Should either succeed or fail for a different reason (not 403)
			try {
				const response = await PUT({ request, params: {} } as any);
				// Success case
				expect(response.status).toBe(200);
			} catch (error: any) {
				// If it fails, it shouldn't be because of read-only mode
				expect(error.status).not.toBe(403);
			}
		});
	});

	describe("DELETE /api/servers/:server", () => {
		it("should return 403 when in read-only mode", async () => {
			process.env.MONGOKU_READ_ONLY_MODE = "true";

			const { DELETE } = await import("../../routes/api/servers/[server]/+server");

			const request = new Request("http://localhost/api/servers/test", {
				method: "DELETE",
			});

			try {
				await DELETE({
					request,
					params: { server: "test" },
				} as any);
				expect.fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.status).toBe(403);
				expect(error.body.message).toContain("Read-only mode");
			}
		});
	});

	describe("POST /api/servers/:server/databases/:database/collections/:collection/documents/:document", () => {
		it("should return 403 when trying to update a document in read-only mode", async () => {
			process.env.MONGOKU_READ_ONLY_MODE = "true";

			const { POST } = await import(
				"../../routes/api/servers/[server]/databases/[database]/collections/[collection]/documents/[document]/+server"
			);

			const request = new Request("http://localhost/api/test", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "updated" }),
			});

			const url = new URL("http://localhost/api/test");

			try {
				await POST({
					request,
					params: {
						server: "test",
						database: "testdb",
						collection: "testcol",
						document: "507f1f77bcf86cd799439011",
					},
					url,
				} as any);
				expect.fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.status).toBe(403);
				expect(error.body.message).toContain("Read-only mode");
			}
		});

		it("should allow updates when not in read-only mode", async () => {
			delete process.env.MONGOKU_READ_ONLY_MODE;

			const { POST } = await import(
				"../../routes/api/servers/[server]/databases/[database]/collections/[collection]/documents/[document]/+server"
			);

			const request = new Request("http://localhost/api/test", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "updated" }),
			});

			const url = new URL("http://localhost/api/test");

			// Should work or fail for a different reason
			try {
				const response = await POST({
					request,
					params: {
						server: "test",
						database: "testdb",
						collection: "testcol",
						document: "507f1f77bcf86cd799439011",
					},
					url,
				} as any);
				// Success case - any 2xx status is fine
				expect(response.status).toBeGreaterThanOrEqual(200);
				expect(response.status).toBeLessThan(300);
			} catch (error: any) {
				// If it fails, it shouldn't be because of read-only mode
				expect(error.status).not.toBe(403);
			}
		});
	});

	describe("DELETE /api/servers/:server/databases/:database/collections/:collection/documents/:document", () => {
		it("should return 403 when trying to delete a document in read-only mode", async () => {
			process.env.MONGOKU_READ_ONLY_MODE = "true";

			const { DELETE } = await import(
				"../../routes/api/servers/[server]/databases/[database]/collections/[collection]/documents/[document]/+server"
			);

			const request = new Request("http://localhost/api/test", {
				method: "DELETE",
			});

			const url = new URL("http://localhost/api/test");

			try {
				await DELETE({
					request,
					params: {
						server: "test",
						database: "testdb",
						collection: "testcol",
						document: "507f1f77bcf86cd799439011",
					},
					url,
				} as any);
				expect.fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.status).toBe(403);
				expect(error.body.message).toContain("Read-only mode");
			}
		});
	});
});
