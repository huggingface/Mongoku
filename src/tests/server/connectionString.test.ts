import { buildDirectConnectionUri, mongoHostKey, parseMongoUri, sanitizeMongoUri } from "$lib/server/connectionString";
import { mongoDisplayName } from "$lib/utils/mongoUri";
import { describe, expect, it } from "vitest";

const MULTI_HOST =
	"mongodb://user:pass@mongodb-mongos-0.moonlanding-bucket-prod.mongodb.internal:27017,mongodb-mongos-1.moonlanding-bucket-prod.mongodb.internal:27017,mongodb-mongos-2.moonlanding-bucket-prod.mongodb.internal:27017/?replicaSet=rs0";

describe("connectionString", () => {
	describe("parseMongoUri", () => {
		it("parses a multi-host (mongos) connection string", () => {
			const parsed = parseMongoUri(MULTI_HOST);
			expect(parsed.protocol).toBe("mongodb:");
			expect(parsed.username).toBe("user");
			expect(parsed.password).toBe("pass");
			expect(parsed.hosts).toHaveLength(3);
			expect(parsed.hosts[0]).toBe("mongodb-mongos-0.moonlanding-bucket-prod.mongodb.internal:27017");
			expect(parsed.hosts[2]).toBe("mongodb-mongos-2.moonlanding-bucket-prod.mongodb.internal:27017");
			expect(parsed.search).toBe("replicaSet=rs0");
		});

		it("parses a simple single-host uri without credentials", () => {
			const parsed = parseMongoUri("mongodb://localhost:27017");
			expect(parsed.username).toBe("");
			expect(parsed.password).toBe("");
			expect(parsed.hosts).toEqual(["localhost:27017"]);
			expect(parsed.pathname).toBe("");
		});

		it("parses mongodb+srv uris", () => {
			const parsed = parseMongoUri("mongodb+srv://user:pass@cluster0.example.mongodb.net/db?w=majority");
			expect(parsed.protocol).toBe("mongodb+srv:");
			expect(parsed.hosts).toEqual(["cluster0.example.mongodb.net"]);
			expect(parsed.pathname).toBe("/db");
			expect(parsed.search).toBe("w=majority");
		});

		it("throws on a non-mongodb scheme", () => {
			expect(() => parseMongoUri("http://example.com")).toThrow();
		});
	});

	describe("mongoHostKey", () => {
		it("returns the raw comma-joined host list for multi-host", () => {
			expect(mongoHostKey(MULTI_HOST)).toBe(
				"mongodb-mongos-0.moonlanding-bucket-prod.mongodb.internal:27017,mongodb-mongos-1.moonlanding-bucket-prod.mongodb.internal:27017,mongodb-mongos-2.moonlanding-bucket-prod.mongodb.internal:27017",
			);
		});

		it("returns the host for a single-host uri", () => {
			expect(mongoHostKey("mongodb://localhost:27017/db")).toBe("localhost:27017");
		});
	});

	describe("sanitizeMongoUri", () => {
		it("masks credentials in a multi-host uri without dropping hosts", () => {
			const out = sanitizeMongoUri(MULTI_HOST);
			expect(out).toContain("***:***@");
			expect(out).not.toContain("user:pass");
			expect(out).toContain("mongodb-mongos-0.moonlanding-bucket-prod.mongodb.internal:27017");
			expect(out).toContain("replicaSet=rs0");
		});

		it("leaves credential-less uris untouched", () => {
			expect(sanitizeMongoUri("mongodb://localhost:27017")).toBe("mongodb://localhost:27017");
		});
	});

	describe("buildDirectConnectionUri", () => {
		it("targets a single node, keeping credentials and adding directConnection", () => {
			const node = "mongodb-mongos-1.moonlanding-bucket-prod.mongodb.internal:27017";
			const out = buildDirectConnectionUri(MULTI_HOST, node);
			expect(out).toContain(`@${node}/`);
			expect(out).toContain("directConnection=true");
			expect(out).toContain("user:pass");
			// only the single node, not the comma list
			expect(out).not.toContain("mongos-0");
			expect(out).not.toContain("mongos-2");
		});

		it("adds tls=true for srv sources", () => {
			const out = buildDirectConnectionUri(
				"mongodb+srv://u:p@cluster0.example.mongodb.net/db",
				"shard-00-00.example.mongodb.net:27017",
			);
			expect(out).toContain("tls=true");
			expect(out).toContain("directConnection=true");
		});
	});

	describe("mongoDisplayName", () => {
		it("strips credentials and port for a single host", () => {
			expect(mongoDisplayName("mongodb://user:pass@db.example.com:27017/admin")).toBe("db.example.com");
		});

		it("collapses a multi-host list to the shared domain with a count", () => {
			// The failing real-world case: don't render a giant comma-joined name.
			expect(mongoDisplayName(MULTI_HOST)).toBe("moonlanding-bucket-prod.mongodb.internal (3 hosts)");
		});

		it("falls back to first host (+n) when hosts share no suffix", () => {
			expect(mongoDisplayName("mongodb://a.foo.com:27017,b.bar.com:27017")).toBe("a.foo.com (+1)");
		});

		it("returns the input unchanged for non-mongodb strings", () => {
			expect(mongoDisplayName("not-a-uri")).toBe("not-a-uri");
		});
	});
});
