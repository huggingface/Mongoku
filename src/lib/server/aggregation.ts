export const ALLOWED_AGGREGATION_STAGES = new Set([
	"$addFields",
	"$bucket",
	"$bucketAuto",
	"$collStats",
	"$count",
	"$densify",
	"$documents",
	"$facet",
	"$fill",
	"$geoNear",
	"$graphLookup",
	"$group",
	"$indexStats",
	"$limit",
	"$listClusterCatalog",
	"$listSampledQueries",
	"$listSearchIndexes",
	"$listSessions",
	"$lookup",
	"$match",
	"$project",
	"$querySettings",
	"$queryStats",
	"$rankFusion",
	"$redact",
	"$replaceRoot",
	"$replaceWith",
	"$sample",
	"$search",
	"$searchMeta",
	"$set",
	"$setWindowFields",
	"$skip",
	"$sort",
	"$sortByCount",
	"$unionWith",
	"$unset",
	"$unwind",
	"$vectorSearch",
]);

export function validateAggregationPipeline(pipeline: unknown[]): void {
	for (let i = 0; i < pipeline.length; i++) {
		const stage = pipeline[i];
		if (!stage || typeof stage !== "object") {
			throw new Error(`Invalid stage at index ${i}: must be an object`);
		}

		const stageKeys = Object.keys(stage);
		if (stageKeys.length !== 1) {
			throw new Error(`Invalid stage at index ${i}: must have exactly one key, found ${stageKeys.length}`);
		}

		const stageOperator = stageKeys[0];
		if (!ALLOWED_AGGREGATION_STAGES.has(stageOperator)) {
			throw new Error(
				`Disallowed stage operator at index ${i}: "${stageOperator}". Only allowed stages are permitted, to avoid future write stages like '$merge' or '$out'.`,
			);
		}
	}
}
