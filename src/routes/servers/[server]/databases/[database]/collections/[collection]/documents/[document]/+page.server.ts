import { resolveDocumentId } from "$lib/server/documentId";
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
		_id: (await resolveDocumentId(collection, params.document)) as ObjectId,
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
