import JsonEncoder from "$lib/server/JsonEncoder";
import { getMongo } from "$lib/server/mongo";
import { ObjectId } from "mongodb";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const collection = mongo.getCollection(params.server, params.database, params.collection);

	let document = null;
	if (collection) {
		// todo: maybe add ObjectId(...) in the url
		const obj = await collection.findOne({
			_id: /^[0-9a-fA-F]{24}$/.test(params.document)
				? new ObjectId(params.document)
				: (params.document as unknown as ObjectId),
		});
		document = JsonEncoder.encode(obj);
	}

	return {
		document,
	};
};
