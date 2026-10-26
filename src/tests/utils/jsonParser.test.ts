import { parseJSON, serializeForEditing } from "$lib/utils/jsonParser";
import { describe, expect, it } from "vitest";

describe("jsonParser", () => {
	describe("serializeForEditing", () => {
		it("round-trips RegExp patterns that contain backslashes", () => {
			const doc = {
				pattern: { $type: "RegExp", $value: { $pattern: "^\\d+\\.\\w*$", $flags: "i" } },
			};

			expect(parseJSON(serializeForEditing(doc))).toEqual(doc);
		});

		it("round-trips RegExp patterns that contain double quotes", () => {
			const doc = {
				pattern: { $type: "RegExp", $value: { $pattern: 'say "hi"', $flags: "" } },
			};

			expect(parseJSON(serializeForEditing(doc))).toEqual(doc);
		});
	});
});
