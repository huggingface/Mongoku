import { ObjectId } from "mongodb";

export default class JsonEncoder {
  static encode(obj: any) {
    if (obj instanceof ObjectId) {
      return {
        $type:  "ObjectId",
        $value: obj.toHexString(),
        $date:  obj.getTimestamp().getTime(),
      };
    }
    if (obj instanceof Date) {
      return {
        $type:  "Date",
        $value: obj.toISOString(),
      };
    }
    if (obj instanceof RegExp) {
      return {
        $type:  "RegExp",
        $value: {
          $pattern: obj.source,
          $flags:   obj.flags,
        },
      };
    }
    if (Array.isArray(obj)) {
      return [...obj.map(JsonEncoder.encode)];
    }
    if (obj && typeof obj === "object") {
      for (const [key, value] of Object.entries(obj)) {
        obj[key] = JsonEncoder.encode(value);
      }
    }

    return obj;
  }

  static decode(obj: any) {
    if (obj && obj.$type === "ObjectId") {
      return new ObjectId(obj.$value);
    }
    if (obj && obj.$type === "Date") {
      return new Date(obj.$value);
    }
    if (obj && obj.$type === "RegExp") {
      return new RegExp(obj.$value.$pattern, obj.$value.$flags);
    }
    if (Array.isArray(obj)) {
      return [...obj.map(JsonEncoder.decode)];
    }
    if (obj && typeof obj === "object") {
      for (const [key, value] of Object.entries(obj)) {
        obj[key] = JsonEncoder.decode(value);
      }
    }

    return obj;
  }
}
