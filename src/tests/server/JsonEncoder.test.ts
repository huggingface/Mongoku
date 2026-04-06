import JsonEncoder from "$lib/server/JsonEncoder";
import { Binary, Decimal128, ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

describe("JsonEncoder", () => {
	describe("encode", () => {
		it("should encode ObjectId", () => {
			const objectId = new ObjectId("507f1f77bcf86cd799439011");
			const encoded = JsonEncoder.encode(objectId);

			expect(encoded).toEqual({
				$type: "ObjectId",
				$value: "507f1f77bcf86cd799439011",
				$date: objectId.getTimestamp().getTime(),
			});
		});

		it("should encode Date", () => {
			const date = new Date("2024-01-15T10:30:00.000Z");
			const encoded = JsonEncoder.encode(date);

			expect(encoded).toEqual({
				$type: "Date",
				$value: "2024-01-15T10:30:00.000Z",
			});
		});

		it("should encode RegExp", () => {
			const regex = /test/gi;
			const encoded = JsonEncoder.encode(regex);

			expect(encoded).toEqual({
				$type: "RegExp",
				$value: {
					$pattern: "test",
					$flags: "gi",
				},
			});
		});

		it("should encode Binary", () => {
			const buffer = Buffer.from("hello world", "utf-8");
			const binary = new Binary(buffer);
			const encoded = JsonEncoder.encode(binary);

			expect(encoded).toEqual({
				$type: "Binary",
				$value: buffer.toString("base64"),
				$subType: binary.sub_type,
			});
		});

		it("should encode Decimal128", () => {
			const decimal = Decimal128.fromString("123.456");
			const encoded = JsonEncoder.encode(decimal);

			expect(encoded).toEqual({
				$type: "Decimal128",
				$value: "123.456",
			});
		});

		it("should encode arrays", () => {
			const arr = [new ObjectId("507f1f77bcf86cd799439011"), new Date("2024-01-15T10:30:00.000Z"), "string", 123];
			const encoded = JsonEncoder.encode(arr);

			expect(encoded).toHaveLength(4);
			expect(encoded[0].$type).toBe("ObjectId");
			expect(encoded[1].$type).toBe("Date");
			expect(encoded[2]).toBe("string");
			expect(encoded[3]).toBe(123);
		});

		it("should encode nested objects", () => {
			const obj = {
				_id: new ObjectId("507f1f77bcf86cd799439011"),
				createdAt: new Date("2024-01-15T10:30:00.000Z"),
				pattern: /test/i,
				nested: {
					value: Decimal128.fromString("99.99"),
				},
			};
			const encoded = JsonEncoder.encode(obj);

			expect(encoded._id.$type).toBe("ObjectId");
			expect(encoded.createdAt.$type).toBe("Date");
			expect(encoded.pattern.$type).toBe("RegExp");
			expect(encoded.nested.value.$type).toBe("Decimal128");
		});

		it("should handle primitive values", () => {
			expect(JsonEncoder.encode("string")).toBe("string");
			expect(JsonEncoder.encode(123)).toBe(123);
			expect(JsonEncoder.encode(true)).toBe(true);
			expect(JsonEncoder.encode(null)).toBe(null);
			expect(JsonEncoder.encode(undefined)).toBe(undefined);
		});
	});

	describe("decode", () => {
		it("should decode ObjectId", () => {
			const encoded = {
				$type: "ObjectId",
				$value: "507f1f77bcf86cd799439011",
				$date: 1357986930000,
			};
			const decoded = JsonEncoder.decode(encoded);

			expect(decoded).toBeInstanceOf(ObjectId);
			expect(decoded.toHexString()).toBe("507f1f77bcf86cd799439011");
		});

		it("should decode Date", () => {
			const encoded = {
				$type: "Date",
				$value: "2024-01-15T10:30:00.000Z",
			};
			const decoded = JsonEncoder.decode(encoded);

			expect(decoded).toBeInstanceOf(Date);
			expect(decoded.toISOString()).toBe("2024-01-15T10:30:00.000Z");
		});

		it("should decode RegExp", () => {
			const encoded = {
				$type: "RegExp",
				$value: {
					$pattern: "test",
					$flags: "gi",
				},
			};
			const decoded = JsonEncoder.decode(encoded);

			expect(decoded).toBeInstanceOf(RegExp);
			expect(decoded.source).toBe("test");
			expect(decoded.flags).toBe("gi");
		});

		it("should decode Binary", () => {
			const originalBuffer = Buffer.from("hello world", "utf-8");
			const encoded = {
				$type: "Binary",
				$value: originalBuffer.toString("base64"),
				$subType: 0,
			};
			const decoded = JsonEncoder.decode(encoded);

			expect(decoded).toBeInstanceOf(Binary);
			expect(Buffer.from(decoded.buffer).toString("utf-8")).toBe("hello world");
			expect(decoded.sub_type).toBe(0);
		});

		it("should decode Decimal128", () => {
			const encoded = {
				$type: "Decimal128",
				$value: "123.456",
			};
			const decoded = JsonEncoder.decode(encoded);

			expect(decoded).toBeInstanceOf(Decimal128);
			expect(decoded.toString()).toBe("123.456");
		});

		it("should decode arrays", () => {
			const encoded = [
				{
					$type: "ObjectId",
					$value: "507f1f77bcf86cd799439011",
					$date: 1357986930000,
				},
				{
					$type: "Date",
					$value: "2024-01-15T10:30:00.000Z",
				},
				"string",
				123,
			];
			const decoded = JsonEncoder.decode(encoded);

			expect(decoded).toHaveLength(4);
			expect(decoded[0]).toBeInstanceOf(ObjectId);
			expect(decoded[1]).toBeInstanceOf(Date);
			expect(decoded[2]).toBe("string");
			expect(decoded[3]).toBe(123);
		});

		it("should decode nested objects", () => {
			const encoded = {
				_id: {
					$type: "ObjectId",
					$value: "507f1f77bcf86cd799439011",
					$date: 1357986930000,
				},
				createdAt: {
					$type: "Date",
					$value: "2024-01-15T10:30:00.000Z",
				},
				nested: {
					value: {
						$type: "Decimal128",
						$value: "99.99",
					},
				},
			};
			const decoded = JsonEncoder.decode(encoded);

			expect(decoded._id).toBeInstanceOf(ObjectId);
			expect(decoded.createdAt).toBeInstanceOf(Date);
			expect(decoded.nested.value).toBeInstanceOf(Decimal128);
		});

		it("should handle primitive values", () => {
			expect(JsonEncoder.decode("string")).toBe("string");
			expect(JsonEncoder.decode(123)).toBe(123);
			expect(JsonEncoder.decode(true)).toBe(true);
			expect(JsonEncoder.decode(null)).toBe(null);
			expect(JsonEncoder.decode(undefined)).toBe(undefined);
		});
	});

	describe("round-trip encoding and decoding", () => {
		it("should correctly round-trip ObjectId", () => {
			const original = new ObjectId("507f1f77bcf86cd799439011");
			const roundTrip = JsonEncoder.decode(JsonEncoder.encode(original));

			expect(roundTrip).toBeInstanceOf(ObjectId);
			expect(roundTrip.toHexString()).toBe(original.toHexString());
		});

		it("should correctly round-trip Date", () => {
			const original = new Date("2024-01-15T10:30:00.000Z");
			const roundTrip = JsonEncoder.decode(JsonEncoder.encode(original));

			expect(roundTrip).toBeInstanceOf(Date);
			expect(roundTrip.getTime()).toBe(original.getTime());
		});

		it("should correctly round-trip RegExp", () => {
			const original = /test/gi;
			const roundTrip = JsonEncoder.decode(JsonEncoder.encode(original));

			expect(roundTrip).toBeInstanceOf(RegExp);
			expect(roundTrip.source).toBe(original.source);
			expect(roundTrip.flags).toBe(original.flags);
		});

		it("should correctly round-trip Binary", () => {
			const buffer = Buffer.from("hello world", "utf-8");
			const original = new Binary(buffer);
			const roundTrip = JsonEncoder.decode(JsonEncoder.encode(original));

			expect(roundTrip).toBeInstanceOf(Binary);
			expect(Buffer.from(roundTrip.buffer).toString("utf-8")).toBe("hello world");
		});

		it("should correctly round-trip Decimal128", () => {
			const original = Decimal128.fromString("123.456");
			const roundTrip = JsonEncoder.decode(JsonEncoder.encode(original));

			expect(roundTrip).toBeInstanceOf(Decimal128);
			expect(roundTrip.toString()).toBe(original.toString());
		});

		it("should correctly round-trip complex nested structure", () => {
			const original = {
				_id: new ObjectId("507f1f77bcf86cd799439011"),
				name: "Test User",
				age: 30,
				isActive: true,
				createdAt: new Date("2024-01-15T10:30:00.000Z"),
				pattern: /email@test\.com/i,
				balance: Decimal128.fromString("1234.56"),
				data: new Binary(Buffer.from("binary data")),
				tags: ["tag1", "tag2"],
				metadata: {
					nested: {
						value: new ObjectId("507f191e810c19729de860ea"),
					},
				},
			};

			const encoded = JsonEncoder.encode(original);
			const decoded = JsonEncoder.decode(encoded);

			expect(decoded._id).toBeInstanceOf(ObjectId);
			expect(decoded._id.toHexString()).toBe("507f1f77bcf86cd799439011");
			expect(decoded.name).toBe("Test User");
			expect(decoded.age).toBe(30);
			expect(decoded.isActive).toBe(true);
			expect(decoded.createdAt).toBeInstanceOf(Date);
			expect(decoded.createdAt.getTime()).toBe(original.createdAt.getTime());
			expect(decoded.pattern).toBeInstanceOf(RegExp);
			expect(decoded.pattern.source).toBe(original.pattern.source);
			expect(decoded.balance).toBeInstanceOf(Decimal128);
			expect(decoded.balance.toString()).toBe("1234.56");
			expect(decoded.data).toBeInstanceOf(Binary);
			expect(decoded.tags).toEqual(["tag1", "tag2"]);
			expect(decoded.metadata.nested.value).toBeInstanceOf(ObjectId);
			expect(decoded.metadata.nested.value.toHexString()).toBe("507f191e810c19729de860ea");
		});
	});
});
