export interface MongoDocument {
	_id?: {
		$type: string;
		$value: string;
	};
	[key: string]: unknown;
}

export interface SearchParams {
	query: string;
	sort: string;
	project: string;
	limit: number;
	skip: number;
}
