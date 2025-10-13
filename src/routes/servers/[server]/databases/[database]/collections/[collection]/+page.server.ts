import JsonEncoder from "$lib/server/JsonEncoder";
import { getMongo } from "$lib/server/mongo";
import type { MongoDocument } from "$lib/types";
import { parseJSON } from "$lib/utils/jsonParser";
import { error } from "@sveltejs/kit";
import type { Document } from "mongodb";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, url }) => {
	const query = url.searchParams.get("query") || "{}";
	const sort = url.searchParams.get("sort") || "{}";
	const project = url.searchParams.get("project") || "{}";
	const skip = parseInt(url.searchParams.get("skip") || "0", 10);
	const limit = parseInt(url.searchParams.get("limit") || "20", 10);

	// Parse JSON strings early for immediate errors
	let queryDoc: unknown;
	try {
		queryDoc = parseJSON(query);
	} catch (err) {
		return error(400, `Invalid query: ${query} - ${err}`);
	}

	let sortDoc: unknown;
	try {
		sortDoc = parseJSON(sort);
	} catch (err) {
		return error(400, `Invalid sort: ${sort} - ${err}`);
	}

	let projectDoc: Document;
	try {
		projectDoc = parseJSON(project) as Document;
	} catch (err) {
		return error(400, `Invalid project: ${project} - ${err}`);
	}

	const mongo = await getMongo();
	const collection = mongo.getCollection(params.server, params.database, params.collection);

	if (!collection) {
		return error(404, `Collection not found: ${params.server}.${params.database}.${params.collection}`);
	}

	// Stream both promises - return error info instead of throwing
	const resultsPromise = collection
		.find(JsonEncoder.decode(queryDoc))
		.project(projectDoc)
		.sort(JsonEncoder.decode(sortDoc))
		.limit(limit)
		.skip(skip)
		.map((obj) => JsonEncoder.encode(obj))
		.toArray()
		.then((results) => ({
			data: results as MongoDocument[],
			error: null as string | null,
		}))
		.catch((err) => {
			console.error("Error fetching query results:", err);
			return {
				data: [] as MongoDocument[],
				error: `Failed to fetch query results: ${err instanceof Error ? err.message : String(err)}`,
			};
		});

	const countPromise = (async () => {
		try {
			if (queryDoc && Object.keys(queryDoc).length > 0) {
				return {
					data: await collection.countDocuments(JsonEncoder.decode(queryDoc), {
						maxTimeMS: mongo.getCountTimeout(),
					}),
					error: null as string | null,
				};
			} else {
				// fast count
				return {
					data: await collection.estimatedDocumentCount(),
					error: null as string | null,
				};
			}
		} catch (err) {
			console.error("Error counting documents:", err);
			return {
				data: 0,
				error: `Failed to count documents: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	})();

	return {
		server: params.server,
		database: params.database,
		collection: params.collection,
		// Stream these promises to the client
		results: resultsPromise,
		count: countPromise,
		params: {
			query,
			sort,
			project,
			skip,
			limit,
		},
	};
};
