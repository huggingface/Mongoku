import { documentIdCandidates, resolveDocumentId } from "$lib/server/documentId";
import { getMongo } from "$lib/server/mongo";
import { ObjectId, type Collection, type Document } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { load } from "../../routes/servers/[server]/databases/[database]/collections/[collection]/documents/[document]/+page.server";

// A collection holding documents with the given _id values; findOne matches on _id equality.
function fakeCollection(docs: Document[]) {
	const findOne = vi.fn(async (filter: { _id: unknown }) => {
		return (
			docs.find((doc) =>
				doc._id instanceof ObjectId && filter._id instanceof ObjectId
					? doc._id.equals(filter._id)
					: doc._id === filter._id,
			) ?? null
		);
	});
	return { collection: { findOne } as unknown as Collection<Document>, findOne };
}

describe("documentIdCandidates", () => {
	it("treats 24 hex characters as an ObjectId", () => {
		const [id] = documentIdCandidates("507f1f77bcf86cd799439011");
		expect(id).toBeInstanceOf(ObjectId);
		expect(documentIdCandidates("507f1f77bcf86cd799439011")).toHaveLength(1);
	});

	it("keeps other strings as strings", () => {
		expect(documentIdCandidates("sku-red-mug")).toEqual(["sku-red-mug"]);
	});

	it("adds the number a numeric string spells", () => {
		expect(documentIdCandidates("1001")).toEqual(["1001", 1001]);
		expect(documentIdCandidates("0")).toEqual(["0", 0]);
		expect(documentIdCandidates("-12.5")).toEqual(["-12.5", -12.5]);
	});

	it("does not read numbers into strings that only look numeric", () => {
		for (const id of ["007", "1e3", "", " 1", "1.0", "Infinity", "NaN", "0x10"]) {
			expect(documentIdCandidates(id)).toEqual([id]);
		}
	});
});

describe("resolveDocumentId", () => {
	it("finds a numeric _id from its string form", async () => {
		const { collection } = fakeCollection([{ _id: 1001 }]);
		expect(await resolveDocumentId(collection, "1001")).toBe(1001);
	});

	it("prefers a string _id over a numeric one", async () => {
		const { collection } = fakeCollection([{ _id: 7 }, { _id: "7" }]);
		expect(await resolveDocumentId(collection, "7")).toBe("7");
	});

	it("falls back to the string when nothing matches", async () => {
		const { collection } = fakeCollection([]);
		expect(await resolveDocumentId(collection, "42")).toBe("42");
	});

	it("does not query for ids with a single candidate", async () => {
		const { collection, findOne } = fakeCollection([{ _id: "sku-red-mug" }]);
		expect(await resolveDocumentId(collection, "sku-red-mug")).toBe("sku-red-mug");
		const objectId = await resolveDocumentId(collection, "507f1f77bcf86cd799439011");
		expect(objectId).toBeInstanceOf(ObjectId);
		expect(findOne).not.toHaveBeenCalled();
	});
});

describe("document page load", () => {
	it("loads a document whose _id is a number", async () => {
		const { collection } = fakeCollection([{ _id: 1001, customer: "Asha" }]);
		vi.mocked(getMongo).mockResolvedValueOnce({
			getClient: () => ({
				db: () => ({ collection: () => collection }),
				getMappings: async () => ({}),
			}),
		} as unknown as Awaited<ReturnType<typeof getMongo>>);

		const result = await load({
			params: { server: "localhost", database: "shop", collection: "orders", document: "1001" },
			parent: async () => ({ readOnly: false }),
		} as unknown as Parameters<typeof load>[0]);

		expect(result).toMatchObject({ document: { _id: 1001, customer: "Asha" } });
	});
});
