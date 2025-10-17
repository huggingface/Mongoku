import JsonEncoder from "$lib/server/JsonEncoder";
import { getMongo } from "$lib/server/mongo";
import type { MongoDocument } from "$lib/types";
import { error, json } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	const { server, database, collection, field, value } = await request.json();

	if (!server || !database || !collection || !field || value === undefined) {
		return error(400, "Missing required parameters");
	}

	try {
		const mongo = await getMongo();
		const coll = mongo.getCollection(server, database, collection);

		if (!coll) {
			return error(404, `Collection not found: ${server}.${database}.${collection}`);
		}

		// Convert value to ObjectId if it looks like one
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let searchValue: any = value;
		if (typeof value === "string" && value.length === 24 && /^[0-9a-fA-F]{24}$/.test(value)) {
			try {
				searchValue = new ObjectId(value);
			} catch {
				// If conversion fails, use the string value
			}
		} else if (value?.$type === "ObjectId" && value?.$value) {
			searchValue = new ObjectId(value.$value);
		}

		// Find document with 5 second timeout and limit 1
		const doc = await coll.findOne({ [field]: searchValue }, { maxTimeMS: 5000 });

		if (!doc) {
			return json({ found: false, document: null });
		}

		return json({
			found: true,
			document: JsonEncoder.encode(doc) as MongoDocument,
		});
	} catch (err) {
		console.error("Error fetching document:", err);
		return error(500, `Failed to fetch document: ${err instanceof Error ? err.message : String(err)}`);
	}
};
