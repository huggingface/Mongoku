import { validateAggregationPipeline } from "$lib/server/aggregation";
import JsonEncoder from "$lib/server/JsonEncoder";
import { logger } from "$lib/server/logger";
import { getMongo } from "$lib/server/mongo";
import { type MongoDocument, type SearchParams } from "$lib/types";
import { isEmptyObject } from "$lib/utils/isEmptyObject";
import { parseJSON } from "$lib/utils/jsonParser";
import type { Document } from "mongodb";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, url }) => {
	const query = url.searchParams.get("query") || "{}";
	const sort = url.searchParams.get("sort") || "{}";
	const project = url.searchParams.get("project") || "{}";
	const skip = parseInt(url.searchParams.get("skip") || "0", 10);
	const limit = parseInt(url.searchParams.get("limit") || "20", 10);
	const mode = url.searchParams.get("mode") || "query";
	const field = url.searchParams.get("field") || "";

	const computedParams = {
		query,
		sort,
		project,
		skip,
		limit,
		mode: mode as "query" | "distinct" | "aggregation",
		field,
	} satisfies SearchParams;

	// Parse JSON strings - return error state if invalid instead of throwing
	let queryDoc: unknown;
	let parseError: string | null = null;

	try {
		queryDoc = parseJSON(query, { allowArray: true });
	} catch (err) {
		parseError = `Invalid query: ${err}`;
	}

	if (!parseError) {
		try {
			parseJSON(sort);
		} catch (err) {
			parseError = `Invalid sort: ${err}`;
		}
	}

	if (!parseError) {
		try {
			parseJSON(project);
		} catch (err) {
			parseError = `Invalid project: ${err}`;
		}
	}

	// If there's a parse error, return the page with error state
	if (parseError) {
		return {
			results: Promise.resolve({
				data: [],
				error: parseError,
			}),
			count: Promise.resolve({
				data: 0,
				error: null,
			}),
			params: computedParams,
		};
	}

	const sortDoc = parseJSON(sort);
	const projectDoc = parseJSON(project) as Document;

	const mongo = await getMongo();
	const client = mongo.getClient(params.server);
	const collection = client.db(params.database).collection(params.collection);

	// Handle distinct mode
	if (mode === "distinct") {
		// Validate distinct field is provided
		if (!field) {
			return {
				results: Promise.resolve({
					data: [],
					error: "Invalid distinct query: field name is required",
				}),
				count: Promise.resolve({
					data: 0,
					error: null,
				}),
				mappings: await client.getMappings(params.database, params.collection),
				params: computedParams,
			};
		}

		const resultsPromise = collection
			.distinct(field, JsonEncoder.decode(queryDoc), {
				maxTimeMS: mongo.getQueryTimeout(),
			})
			.then((results) => ({
				data: results.map((value) => JsonEncoder.encode({ value })) as MongoDocument[],
				error: null as string | null,
			}))
			.catch((err) => {
				logger.error("Error executing distinct:", err);
				return {
					data: [] as MongoDocument[],
					error: `Failed to execute distinct: ${err instanceof Error ? err.message : String(err)}`,
				};
			});

		const countPromise = resultsPromise.then((result) => ({
			data: result.error ? 0 : result.data.length,
			error: null,
		}));

		return {
			results: resultsPromise,
			count: countPromise,
			mappings: await client.getMappings(params.database, params.collection),
			params: computedParams,
		};
	}

	// Handle aggregation mode
	if (mode === "aggregation" && Array.isArray(queryDoc)) {
		// Validate aggregation pipeline
		try {
			validateAggregationPipeline(queryDoc);
		} catch (err) {
			const validationError = `Invalid aggregation pipeline: ${err instanceof Error ? err.message : String(err)}`;
			return {
				results: Promise.resolve({
					data: [],
					error: validationError,
				}),
				count: Promise.resolve({
					data: 0,
					error: null,
				}),
				params: computedParams,
			};
		}
		// Execute aggregation
		const pipeline = JsonEncoder.decode(queryDoc);

		const resultsPromise = collection
			.aggregate(
				[
					...pipeline,
					...(isEmptyObject(projectDoc) ? [] : [{ $project: projectDoc }]),
					...(isEmptyObject(sortDoc as object) ? [] : [{ $sort: sortDoc }]),
					{ $limit: limit },
					{ $skip: skip },
				],
				{
					maxTimeMS: mongo.getQueryTimeout(),
				},
			)
			.map((obj) => JsonEncoder.encode(obj))
			.toArray()
			.then((results) => ({
				data: results as MongoDocument[],
				error: null as string | null,
			}))
			.catch((err) => {
				logger.error("Error executing aggregation:", err);
				return {
					data: [] as MongoDocument[],
					error: `Failed to execute aggregation: ${err instanceof Error ? err.message : String(err)}`,
				};
			});

		// For aggregations, we can't easily get a count, so we return the result count
		const countPromise = collection
			.aggregate([...pipeline, { $count: "count" }], { maxTimeMS: mongo.getCountTimeout() })
			.next()
			.then((result) => ({
				data: result?.count ?? 0,
				error: null,
			}))
			.catch((err) => {
				logger.error("Error counting documents:", err);
				return {
					data: 0,
					error: `Failed to count documents: ${err instanceof Error ? err.message : String(err)}`,
				};
			});

		return {
			results: resultsPromise,
			count: countPromise,
			mappings: await client.getMappings(params.database, params.collection),
			params: computedParams,
		};
	}

	const resultsPromise = collection
		.find(JsonEncoder.decode(queryDoc), { maxTimeMS: mongo.getQueryTimeout() })
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
			logger.error("Error fetching query results:", err);
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
			logger.error("Error counting documents:", err);
			return {
				data: 0,
				error: `Failed to count documents: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	})();

	return {
		// Stream these promises to the client
		results: resultsPromise,
		count: countPromise,
		mappings: await client.getMappings(params.database, params.collection),
		params: computedParams,
	};
};
