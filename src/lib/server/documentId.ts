import { ObjectId, type Collection, type Document } from "mongodb";

/**
 * The `_id` values a document id string can stand for, in the order to try them.
 *
 * Ids reach the server as strings (URL segment or remote command payload), so a
 * numeric `_id` such as `1001` arrives as `"1001"`. A 24-character hex string is
 * an ObjectId; anything else is the string itself, followed by the number it
 * spells when it is written exactly as that number prints (`"1001"`, `"-12.5"`).
 */
export function documentIdCandidates(id: string): unknown[] {
	if (/^[0-9a-fA-F]{24}$/.test(id)) {
		return [new ObjectId(id)];
	}

	const candidates: unknown[] = [id];
	const asNumber = Number(id);
	if (id.trim() !== "" && Number.isFinite(asNumber) && String(asNumber) === id) {
		candidates.push(asNumber);
	}
	return candidates;
}

/**
 * Resolve a document id string to the `_id` value stored in the collection.
 *
 * A string `_id` is preferred over a numeric one, so documents that are found
 * today keep being found. When nothing matches, the first candidate is returned
 * (the previous behaviour, e.g. for upserts).
 */
export async function resolveDocumentId(collection: Collection<Document>, id: string): Promise<unknown> {
	const candidates = documentIdCandidates(id);
	if (candidates.length > 1) {
		for (const candidate of candidates) {
			const found = await collection.findOne({ _id: candidate as ObjectId }, { projection: { _id: 1 } });
			if (found) {
				return candidate;
			}
		}
	}
	return candidates[0];
}
