import * as MongoDb from "mongodb";

const objid_re = /^ObjectId\('?([0-9a-fA-F]{24})'?\)$/;
export default class JsonEncoder {
  static fromObjectId(obj: string) {
    const match = objid_re.exec(obj);
    if (match && match[1])
      return new MongoDb.ObjectId(match[1]);
    return obj;
  }
  static encode(obj: any) {
    if (obj instanceof MongoDb.ObjectId) {
      return {
        $type:  'ObjectId',
        $value: obj.toHexString(),
        $date:  obj.getTimestamp().getTime()
      };
    }
    if (obj instanceof MongoDb.Binary) {
      return {
        $type:  'Binary',
        $value:  {
          $sub_type: obj.sub_type,
          $data: Buffer.from(obj.buffer).toString('base64')
        }
      };
    }
    if (obj instanceof Date) {
      return {
        $type: 'Date',
        $value: obj.toISOString()
      };
    }
    if (obj instanceof RegExp) {
      return {
        $type: 'RegExp',
        $value: {
          $pattern: obj.source,
          $flags:   obj.flags
        }
      };
    }
    if (Array.isArray(obj)) {
      return [...obj.map(JsonEncoder.encode)];
    }
    if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        obj[key] = JsonEncoder.encode(value);
      }
    }

    return obj;
  }

  static decode(obj: any) {
    if (obj && obj.$type === 'ObjectId') {
      return new MongoDb.ObjectId(obj.$value);
    }
    if (obj && obj.$type === 'Binary') {
      return new MongoDb.Binary(Buffer.from(obj.$value.$data, 'base64'), parseInt(obj.$value.$sub_type));
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
    if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        obj[key] = JsonEncoder.decode(value);
      }
    }

    return obj;
  }
}
