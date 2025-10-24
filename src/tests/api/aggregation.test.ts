/* eslint-disable @typescript-eslint/no-explicit-any */
import { ALLOWED_AGGREGATION_STAGES, validateAggregationPipeline } from "$lib/server/aggregation";
import { describe, expect, it } from "vitest";

// Test the aggregation validation logic
describe("Aggregation Pipeline Validation", () => {
	it("should accept valid aggregation pipelines with allowed stages", () => {
		const validPipelines = [
			[{ $match: { status: "active" } }],
			[{ $match: { status: "active" } }, { $group: { _id: "$category", count: { $sum: 1 } } }],
			[{ $sort: { createdAt: -1 } }, { $limit: 10 }],
			[
				{ $match: { price: { $gte: 100 } } },
				{ $group: { _id: "$category", avgPrice: { $avg: "$price" } } },
				{ $sort: { avgPrice: -1 } },
			],
			[{ $lookup: { from: "orders", localField: "_id", foreignField: "userId", as: "orders" } }],
			[{ $unwind: "$tags" }],
			[{ $project: { name: 1, email: 1 } }],
			[{ $addFields: { fullName: { $concat: ["$firstName", " ", "$lastName"] } } }],
			[{ $replaceRoot: { newRoot: "$address" } }],
			[{ $facet: { byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }] } }],
		];

		for (const pipeline of validPipelines) {
			expect(() => validateAggregationPipeline(pipeline)).not.toThrow();
		}
	});

	describe("should reject pipelines with disallowed stages", () => {
		const invalidStages = ["$out", "$merge", "$changeStream"];

		for (const stage of invalidStages) {
			it(`should reject pipeline with disallowed stage: ${stage}`, () => {
				const pipeline = [{ [stage]: {} }];
				expect(() => validateAggregationPipeline(pipeline)).toThrow(/Disallowed stage operator/);
			});
		}
	});

	it("should reject invalid pipeline structures", () => {
		// Stage is not an object
		expect(() => validateAggregationPipeline(["invalid" as any])).toThrow(
			/Invalid stage at index 0: must be an object/,
		);

		// Stage has no keys
		expect(() => validateAggregationPipeline([{}])).toThrow(/Invalid stage at index 0: must have exactly one key/);

		// Stage has multiple keys
		expect(() => validateAggregationPipeline([{ $match: {}, $sort: {} }])).toThrow(
			/Invalid stage at index 0: must have exactly one key/,
		);

		// Null stage
		expect(() => validateAggregationPipeline([null as any])).toThrow(/Invalid stage at index 0: must be an object/);
	});

	it("should validate all allowed stages are accepted", () => {
		for (const stage of ALLOWED_AGGREGATION_STAGES) {
			const pipeline = [{ [stage]: {} }];
			expect(() => validateAggregationPipeline(pipeline)).not.toThrow();
		}
	});

	it("should provide clear error messages for disallowed stages", () => {
		const pipeline = [{ $out: { db: "other", coll: "collection" } }];

		try {
			validateAggregationPipeline(pipeline);
			expect.fail("Should have thrown an error");
		} catch (error: any) {
			expect(error.message).toContain("Disallowed stage operator");
			expect(error.message).toContain("$out");
			expect(error.message).toContain("index 0");
		}
	});

	it("should validate complex multi-stage pipelines", () => {
		const complexPipeline = [
			{ $match: { status: "active", price: { $gte: 10 } } },
			{
				$lookup: {
					from: "categories",
					localField: "categoryId",
					foreignField: "_id",
					as: "category",
				},
			},
			{ $unwind: "$category" },
			{
				$group: {
					_id: "$category.name",
					totalSales: { $sum: "$price" },
					count: { $sum: 1 },
				},
			},
			{ $sort: { totalSales: -1 } },
			{ $limit: 10 },
			{
				$project: {
					_id: 0,
					category: "$_id",
					totalSales: 1,
					count: 1,
					avgPrice: { $divide: ["$totalSales", "$count"] },
				},
			},
		];

		expect(() => validateAggregationPipeline(complexPipeline)).not.toThrow();
	});

	it("should reject pipeline with mixed valid and invalid stages", () => {
		const pipeline = [
			{ $match: { status: "active" } },
			{ $group: { _id: "$category", count: { $sum: 1 } } },
			{ $out: "output_collection" }, // Invalid stage
			{ $sort: { count: -1 } },
		];

		expect(() => validateAggregationPipeline(pipeline)).toThrow(/Disallowed stage operator/);
		expect(() => validateAggregationPipeline(pipeline)).toThrow(/\$out/);
	});
});
