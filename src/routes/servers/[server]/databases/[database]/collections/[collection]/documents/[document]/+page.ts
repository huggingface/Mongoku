import type { PageLoad } from "./$types";
import type { MongoDocument } from "$lib/types";

export const load: PageLoad = async ({ params, fetch }) => {
	// Fetch read-only status
	const readOnlyResponse = await fetch("/api/readonly");
	const readOnlyData = await readOnlyResponse.json();

	// Fetch document
	const documentResponse = await fetch(
		`/api/servers/${encodeURIComponent(params.server)}/databases/${encodeURIComponent(params.database)}/collections/${encodeURIComponent(params.collection)}/documents/${params.document}`,
	);

	let document: MongoDocument | null = null;
	if (documentResponse.ok) {
		const data = await documentResponse.json();
		document = data.document;
	}

	return {
		server: params.server,
		database: params.database,
		collection: params.collection,
		documentId: params.document,
		readOnly: readOnlyData.readOnly || false,
		document,
	};
};
