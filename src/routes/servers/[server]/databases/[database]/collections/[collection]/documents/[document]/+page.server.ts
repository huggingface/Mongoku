import JsonEncoder from "$lib/server/JsonEncoder";
import { getMongo } from "$lib/server/mongo";
import { ObjectId } from "mongodb";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const collection = mongo.getCollection(params.server, params.database, params.collection);

	let document = null;
	if (collection) {
		const obj = await collection.findOne({
			_id: new ObjectId(params.document),
		});
		document = JsonEncoder.encode(obj);
	}

	return {
		document,
	};
};
