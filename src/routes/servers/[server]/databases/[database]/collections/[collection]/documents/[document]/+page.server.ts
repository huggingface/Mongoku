import JsonEncoder from "$lib/server/JsonEncoder";
import { getMongo } from "$lib/server/mongo";
import { ObjectId } from "mongodb";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, parent }) => {
	const mongo = await getMongo();
	const client = mongo.getClient(params.server);
	const collection = client.db(params.database).collection(params.collection);

	let document = null;
	const obj = await collection.findOne({
		_id: /^[0-9a-fA-F]{24}$/.test(params.document)
			? new ObjectId(params.document)
			: (params.document as unknown as ObjectId),
	});

	document = obj ? JsonEncoder.encode(obj) : null;

	const parentData = await parent();

	return {
		document,
		documentId: params.document,
		mappings: await client.getMappings(params.database, params.collection),
		readOnly: parentData.readOnly,
	};
};
